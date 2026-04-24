import { initUI } from "./init/app.js";

import './index.css';

console.log('take-control loaded');

initUI().catch((err) => console.error("[take-control] initUI error:", err));