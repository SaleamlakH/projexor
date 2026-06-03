// ---- inferred return types ----

function returnsNumber() {
  return 42;
}

function returnsString() {
  return 'hello';
}

function returnsBoolean() {
  return true;
}

function addNumbers(x, y) {
  const sum = x + y;
  return sum;
}

function buildMessage(prefix, value) {
  const message = prefix + ': ' + value;
  return message;
}

const multiplyArrow = (x, y) => {
  const result = x * y;
  return result;
};

const greetArrow = (name) => {
  const greeting = 'Hello, ' + name;
  return greeting;
};

// ---- class field inference and constructor assignments ----

class Store {
  count = 0;
  label = '';
  items = ['hello'];
  active = true;

  constructor(label, count) {
    this.label = label;
    this.count = count;
    this.thisProperty = 'to-be-captured';
  }

  increment() {
    const next = this.count + 1;
    return next;
  }
}
