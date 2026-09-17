// Binding for the lightweight cross-platform curl runner.

import { Call as $Call, CancellablePromise as $CancellablePromise } from "@wailsio/runtime";
import type * as $models from "./models.js";

export function RunCurl(command: string): $CancellablePromise<$models.RunResult> {
    return $Call.ByName("main.CurlRunner.RunCurl", command);
}

export function RunCurlStream(command: string, runID: string): $CancellablePromise<$models.RunResult> {
    return $Call.ByName("main.CurlRunner.RunCurlStream", command, runID);
}

export function StopCurl(): $CancellablePromise<void> {
    return $Call.ByName("main.CurlRunner.StopCurl");
}
