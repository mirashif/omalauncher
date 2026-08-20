// Pure list-navigation helpers shared by QML and Node tests.

function text(value) {
  return String(value || "")
}

function sectionJumpIndex(rows, currentIndex, delta) {
  var values = rows || []
  if (values.length === 0) return 0
  var current = Math.max(0, Math.min(values.length - 1, Number(currentIndex || 0)))
  var direction = Number(delta || 0)
  var currentSection = text(values[current] && values[current].section)

  if (direction > 0) {
    for (var next = current + 1; next < values.length; next++) {
      if (text(values[next] && values[next].section) !== currentSection) return next
    }
    return current
  }

  if (direction < 0) {
    var previous = current - 1
    while (previous >= 0 && text(values[previous] && values[previous].section) === currentSection) previous -= 1
    if (previous < 0) return current
    var previousSection = text(values[previous] && values[previous].section)
    while (previous > 0 && text(values[previous - 1] && values[previous - 1].section) === previousSection) previous -= 1
    return previous
  }

  return current
}

if (typeof module !== "undefined") {
  module.exports = { sectionJumpIndex: sectionJumpIndex }
}
