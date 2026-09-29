/** Browser entry: reads the embedded theme data and mounts the playground. */
import { mountPlayground, type PlaygroundData } from "./app.js";

const data = JSON.parse(document.getElementById("data")!.textContent!) as PlaygroundData;
mountPlayground(document.getElementById("app")!, data);
