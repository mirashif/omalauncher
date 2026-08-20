// Pure asynchronous-generation helpers shared by QML and Node tests.

function number(value) {
  var parsed = Math.floor(Number(value || 0))
  return isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function next(current) {
  return number(current) + 1
}

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
