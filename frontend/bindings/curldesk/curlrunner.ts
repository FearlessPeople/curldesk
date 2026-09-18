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

export function StopCurlByID(runID: string): $CancellablePromise<void> {
    return $Call.ByName("main.CurlRunner.StopCurlByID", runID);
}

export function SetCurlPath(path: string): $CancellablePromise<void> {
    return $Call.ByName("main.CurlRunner.SetCurlPath", path);
}

export function SetTimeout(timeoutMs: number): $CancellablePromise<void> {
    return $Call.ByName("main.CurlRunner.SetTimeout", timeoutMs);
}

export function ValidateCurl(command: string): $CancellablePromise<$models.CurlValidation> {
    return $Call.ByName("main.CurlRunner.ValidateCurl", command);
}

export function GetDiagnostics(): $CancellablePromise<$models.DiagnosticInfo> {
    return $Call.ByName("main.CurlRunner.GetDiagnostics");
}
