import { Project } from "ts-morph";
const project = new Project();
project.addSourceFilesAtPaths(["/home/poonam/data/demo/**/*.ts"]);
console.log("Found:", project.getSourceFiles().length);
