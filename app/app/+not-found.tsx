// Unmatched routes land here. On the web the page may be served from a path that is
// not an app route (e.g. a hosted preview), so send the user to the real start screen;
// the auth gate in the root layout then routes to sign-in, onboarding, or home.

import { Redirect } from "expo-router";

export default function NotFound() {
  return <Redirect href="/" />;
}
