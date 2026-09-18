import { render } from "@gpuix/react";
import App from "./dashboard-components/App";
import "./platform/runtime";

render(<App />, {
  title: "Academic Dashboard",
  width: 1280,
  height: 820,
  minWidth: 900,
  minHeight: 620,
});
