// Pure asynchronous-generation helpers shared by QML and Node tests.

/** @typedef {import("../types/models").GenerationCompletion} GenerationCompletion */

/**
 * @param {unknown} value
 * @returns {number}
 */
function number(value) {
  var parsed = Math.floor(Number(value || 0))
  return isFinite(parsed) && parsed >= 0 ? parsed : 0
}

/**
 * @param {unknown} current
 * @returns {number}
 */
function next(current) {
  return number(current) + 1
}

/**
 * @param {unknown} activeGeneration
 * @param {unknown} currentGeneration
 * @param {unknown} pending
 * @returns {GenerationCompletion}
 */
function completion(activeGeneration, currentGeneration, pending) {
  var apply = number(activeGeneration) === number(currentGeneration)
  return {
    apply: apply,
    restart: pending === true || !apply
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    next: next,
    completion: completion
  }
}
