console.log("Hello, World!");

const name = "Alice";
const age = 25;
console.log(`Name: ${name}, Age: ${age}`);   // template literal

console.info("Info message");
console.warn("Warning message");
console.error("Error message");
console.table([{ name: "Alice", age: 25 }, { name: "Bob", age: 30 }]);
console.log({ name, age });   // logs as an object