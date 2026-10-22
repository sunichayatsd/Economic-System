import GoogleProvider from "next-auth/providers/google";

export const ALLOWED_DOMAIN = "thestandard.co";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  callbacks: {
    // `hd` in the request is only a hint — the signed profile is what actually proves the domain
    async signIn({ profile }) {
      const email = String(profile?.email || "").toLowerCase();
      return profile?.email_verified === true && profile?.hd === ALLOWED_DOMAIN && email.endsWith("@" + ALLOWED_DOMAIN);
    },
  },
};
