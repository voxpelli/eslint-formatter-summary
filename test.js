// This file is used to try out the formatter
// Run: npm run try test.js

a = process.env.FOO;

const b = 2;

b = !a == null;
b = 4;
b = 4;
b = 4;
b = 4;
b = 'abc'.split('');
b = 4;
b = 4;
b = 4 ** 3;
b = Promise.resolve().then(() => {});

console.log(b);

function foo () {}
