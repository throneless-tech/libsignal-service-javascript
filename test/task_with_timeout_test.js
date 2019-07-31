"use strict";
var assert = require("chai").assert;
var createTaskWithTimeout = require("../src/taskWithTimeout.js");

describe("createTaskWithTimeout", () => {
  it("resolves when promise resolves", () => {
    const task = () => Promise.resolve("hi!");
    const taskWithTimeout = createTaskWithTimeout(task);

    return taskWithTimeout().then(result => {
      assert.strictEqual(result, "hi!");
    });
  });
  it("flows error from promise back", () => {
    const error = new Error("original");
    const task = () => Promise.reject(error);
    const taskWithTimeout = createTaskWithTimeout(task);

    return taskWithTimeout().catch(flowedError => {
      assert.strictEqual(error, flowedError);
    });
  });
  it("rejects if promise takes too long (this one logs error to console)", () => {
    let complete = false;
    const task = () =>
      new Promise(resolve => {
        setTimeout(() => {
          complete = true;
          resolve();
        }, 3000);
      });
    const taskWithTimeout = createTaskWithTimeout(task, this.name, {
      timeout: 10
    });

    return taskWithTimeout().then(
      () => {
        throw new Error("it was not supposed to resolve!");
      },
      () => {
        assert.strictEqual(complete, false);
      }
    );
  });
  it("resolves if task returns something falsey", () => {
    const task = () => {};
    const taskWithTimeout = createTaskWithTimeout(task);
    return taskWithTimeout();
  });
  it("resolves if task returns a non-promise", () => {
    const task = () => "hi!";
    const taskWithTimeout = createTaskWithTimeout(task);
    return taskWithTimeout().then(result => {
      assert.strictEqual(result, "hi!");
    });
  });
  it("rejects if task throws (and does not log about taking too long)", () => {
    const error = new Error("Task is throwing!");
    const task = () => {
      throw error;
    };
    const taskWithTimeout = createTaskWithTimeout(task, this.name, {
      timeout: 10
    });
    return taskWithTimeout().then(
      () => {
        throw new Error("Overall task should reject!");
      },
      flowedError => {
        assert.strictEqual(flowedError, error);
      }
    );
  });
});
