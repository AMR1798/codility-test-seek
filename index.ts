"use strict";

// people say lodash = bad idk?
import lodash from "lodash";
import { v4 as uuidv4 } from "uuid";
// import uuidv4 from 'uuid/v4';

import express from "express";
import { Request, Response } from "express";

const app = express();
app.use(express.json());

type User = {
  user_id: string;
  login: string;
  password: string;
  active_token: string | undefined;
};

type LoggedUser = {
  login: string;
  token: string;
};
type ArticleInfo = {
  article_id: string;
  title: string;
  content: string;
  visibility: "public" | "private" | "logged_in";
  user_id: string;
};

// map so can find easier
const articles: Record<string, ArticleInfo> = {};

const registeredUser: Record<string, User> = {};

const active_token: Record<string, string> = {};

// Your code starts here.
// Placeholders for all requests are provided for your convenience.

app.post("/api/user", (req: Request, res: Response) => {
  if (!validateBody(req, ["user_id", "login", "password"])) {
    res.status(400).send({
      message: "request body invalid",
    });
  } else if (isUserExists(req.body.login)) {
    res.status(409).send({
      message: "login exists",
    });
  } else {
    const newUser: User = {
      user_id: req.body.user_id,
      login: req.body.login,
      // maybe we should hash this. but idk how to do it without package :(
      password: req.body.password,
      active_token: undefined,
    };

    registeredUser[req.body.login] = newUser;
    res.status(201).send({
      message: "user created",
    });
  }
});

app.post("/api/authenticate", (req: Request, res: Response) => {
  if (!validateBody(req, ["login", "password"])) {
    res.status(400).send({
      message: "request body invalid",
    });
  } else if (!isUserExists(req.body.login)) {
    res.status(404).send({
      message: "user not found",
    });
  } else {
    const token = login(req.body.login, req.body.password);
    if (!token) {
      res.status(401).send({
        message: "credential does not match",
      });
    } else {
      res.status(200).send({
        token: token,
      });
    }
  }

  res.end();
});

app.post("/api/logout", (req: Request, res: Response) => {
  const logged = validateAuth(req);

  if (!logged) {
    res.status(401).send({
      message: "unauthorized",
    });
  } else {
    logout(logged.login, logged.token);
    res.status(200).send({
      message: "logout success",
    });
  }
});

app.post("/api/articles", (req: Request, res: Response) => {
  const logged = validateAuth(req);
  if (
    !validateBody(req, ["article_id", "title", "content", "visibility"], {
      visibility: {
        type: "in",
        check: ["public", "private", "logged_in"],
      },
    })
  ) {
    res.status(400).send({
      message: "request body invalid",
    });
  } else if (!logged) {
    res.status(401).send({
      message: "unauthorized",
    });
  } else {
    const user = registeredUser[logged.login];
    const newArticle: ArticleInfo = {
      article_id: req.body.article_id,
      title: req.body.title,
      content: req.body.content,
      visibility: req.body.visibility,
      user_id: user.user_id,
    };

    articles[newArticle.article_id] = newArticle;

    res.status(201).send({
      message: "article created",
    });
  }
  res.end();
});

app.get("/api/articles", (req: Request, res: Response) => {
    const logged = validateAuth(req);
    const result = getArticles(logged ? getUser(logged.login).user_id : undefined);

    
    res.status(200).send(result)
});

function isUserExists(login: string): boolean {
  if (registeredUser[login]) {
    return true;
  }
  return false;
}

function login(login: string, password: string): string | boolean {
  const user = registeredUser[login];
  // should hash password and compare with hashed stored
  if (password !== user.password) {
    return false;
  }
  user.active_token = uuidv4() as string;
  registeredUser[login] = user;
  active_token[user.active_token] = login;
  return user.active_token;
}

function validateBody(
  req: Request,
  keys: string[],
  validation?: Record<string, any>
): boolean {
  let validate = true;
  const body = req.body;
  keys.forEach((item) => {
    if (body[item] === undefined || body[item] === "") {
      validate = false;
    }
    if (validation) {
        // macgyver dis validation
      const doValidation = validation[item];
      if (doValidation !== undefined) {
        switch (doValidation.type) {
          case "in": {
            if (!doValidation.check.includes(body[item])) {
              return false;
            }
          }
        }
      }
    }
  });
  return validate;
}

function validateAuth(req: Request): LoggedUser | false {
  if (req.headers["authentication-header"] === undefined) {
    return false;
  }
  const token = req.headers["authentication-header"] as string;
  const logged = active_token[token];
  if (logged === undefined) {
    return false;
  }

  return {
    login: logged,
    token: token,
  };
}

function getUser(login: string): User {
  return registeredUser[login];
}

function logout(login: string, token: string) {
  registeredUser[login].active_token = undefined;
  delete active_token[token];
}

// basically gave up to use any kind of map 
function getArticles(user_id?: string): ArticleInfo[] {
    const filtered: ArticleInfo[] = [];
    for (const key in articles) {
        if (
            articles[key].visibility === 'public' || 
            (articles[key].visibility === 'logged_in' && user_id !== undefined) || 
            (articles[key].visibility === 'private' && articles[key].user_id === user_id)
        ){
            filtered.push(articles[key]);
        }
    }
    return filtered;
}

exports.default = app.listen(process.env.HTTP_PORT || 3000);
