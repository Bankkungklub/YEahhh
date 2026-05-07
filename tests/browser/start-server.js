process.env.PORT = process.env.PORT || "3101";
process.env.NODE_ENV = process.env.NODE_ENV || "test-browser";

await import("../../server/index.js");
