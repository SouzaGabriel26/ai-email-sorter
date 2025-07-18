import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/", // Redirect to home page instead of default sign-in page
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
