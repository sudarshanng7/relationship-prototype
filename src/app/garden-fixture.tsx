import React from "react";
import { Redirect } from "expo-router";

/**
 * Backward-compatible redirect for garden fixture link.
 * Routes to the comprehensive /garden-visual-qa laboratory in development,
 * and safely to /garden in production builds.
 */
export default function GardenFixtureRoute() {
  if (!__DEV__) {
    return <Redirect href="/garden" />;
  }

  return <Redirect href="/garden-visual-qa" />;
}
