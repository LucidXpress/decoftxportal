import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { getSupabase } from "@/lib/supabaseClient";
import type { Role } from "@/types/database";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET must be set in production.");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Portal login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        if (!checkAuthRateLimit(email).allowed) return null;
        const { data: user, error } = await getSupabase()
          .from("users")
          .select("id, email, name, password, role")
          .eq("email", email)
          .not("password", "is", null)
          .maybeSingle();
        if (error || !user?.password) return null;
        const ok = bcrypt.compareSync(String(credentials.password), user.password);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role: user.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? "reception";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id ?? "";
        (session.user as { role: Role }).role = (token.role as Role) ?? "reception";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
});
