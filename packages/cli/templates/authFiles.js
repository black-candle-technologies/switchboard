import path from "path";

import { importPath } from "../src/project/importPath.js";
import { GENERATED_FILE_MARKER } from "../src/utils/fileActions.js";

export function authSupportFiles(layout, auth) {
  const authPath = path.join(layout.switchboardDir, "auth.ts");
  const actionsPath = path.join(layout.switchboardDir, "auth-actions.ts");
  const prismaPath = path.join(layout.libDir, "prisma.ts");
  const loginPagePath = path.join(
    layout.appDir,
    "admin",
    "login",
    "page.tsx",
  );
  const logoutRoutePath = path.join(
    layout.appDir,
    "admin",
    "logout",
    "route.ts",
  );
  const middlewarePath = path.join(layout.sourceRoot, "middleware.ts");

  return [
    {
      path: authPath,
      content: `
        // ${GENERATED_FILE_MARKER}
        import {
          createHmac,
          randomBytes,
          scrypt as scryptCallback,
          timingSafeEqual,
        } from "node:crypto";

        const KEY_LENGTH = 64;
        const SCRYPT_OPTIONS = {
          N: 16384,
          r: 8,
          p: 1,
          maxmem: 64 * 1024 * 1024,
        };
        const SESSION_DURATION_SECONDS = 60 * 60 * 8;

        export const SWITCHBOARD_SESSION_COOKIE = "switchboard_session";

        type SessionPayload = {
          userId: string;
          role: "ADMIN";
          expiresAt: number;
        };

        function sessionSecret() {
          const secret = process.env.SWITCHBOARD_SESSION_SECRET;
          if (!secret || secret.length < 32) {
            throw new Error(
              "SWITCHBOARD_SESSION_SECRET is required and must be at least 32 characters.",
            );
          }
          return secret;
        }

        function scryptPassword(password: string, salt: Buffer) {
          return new Promise<Buffer>((resolve, reject) => {
            scryptCallback(
              password,
              salt,
              KEY_LENGTH,
              SCRYPT_OPTIONS,
              (error, derivedKey) => {
                if (error) reject(error);
                else resolve(derivedKey);
              },
            );
          });
        }

        function signature(value: string) {
          return createHmac("sha256", sessionSecret())
            .update(value)
            .digest("base64url");
        }

        export function createSessionToken(userId: string) {
          const payload: SessionPayload = {
            userId,
            role: "ADMIN",
            expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
          };
          const encoded = Buffer.from(JSON.stringify(payload)).toString(
            "base64url",
          );
          return encoded + "." + signature(encoded);
        }

        export function sessionCookieOptions() {
          return {
            httpOnly: true,
            sameSite: "lax" as const,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: SESSION_DURATION_SECONDS,
          };
        }

        export async function hashPassword(password: string) {
          const salt = randomBytes(16);
          const derivedKey = await scryptPassword(password, salt);
          return [
            "scrypt",
            SCRYPT_OPTIONS.N,
            SCRYPT_OPTIONS.r,
            SCRYPT_OPTIONS.p,
            salt.toString("base64url"),
            Buffer.from(derivedKey).toString("base64url"),
          ].join("$");
        }

        export async function verifyPassword(
          password: string,
          storedHash: string,
        ) {
          const [algorithm, n, r, p, saltValue, hashValue] =
            storedHash.split("$");
          const validFormat =
            algorithm === "scrypt" &&
            n === String(SCRYPT_OPTIONS.N) &&
            r === String(SCRYPT_OPTIONS.r) &&
            p === String(SCRYPT_OPTIONS.p);
          const salt = validFormat
            ? Buffer.from(saltValue ?? "", "base64url")
            : Buffer.alloc(16);
          const expected = validFormat
            ? Buffer.from(hashValue ?? "", "base64url")
            : Buffer.alloc(KEY_LENGTH);
          const comparable =
            validFormat &&
            salt.length === 16 &&
            expected.length === KEY_LENGTH;
          const actual = await scryptPassword(
            password,
            comparable ? salt : Buffer.alloc(16),
          );
          return (
            comparable &&
            timingSafeEqual(expected, Buffer.from(actual))
          );
        }
      `,
    },
    {
      path: actionsPath,
      content: `
        // ${GENERATED_FILE_MARKER}
        "use server";

        import { cookies } from "next/headers";
        import { redirect } from "next/navigation";

        import { prisma } from "${importPath(layout, actionsPath, prismaPath)}";
        import {
          createSessionToken,
          sessionCookieOptions,
          SWITCHBOARD_SESSION_COOKIE,
          verifyPassword,
        } from "${importPath(layout, actionsPath, authPath)}";

        export async function login(formData: FormData) {
          const credential = String(formData.get("credential") ?? "").trim();
          const password = String(formData.get("password") ?? "");
          if (!credential || !password) {
            redirect("/admin/login?error=missing");
          }

          const user = await prisma.${auth.clientProperty}.findUnique({
            where: { ${auth.credentialField}: credential },
            select: {
              ${auth.idField}: true,
              ${auth.passwordField}: true,
              ${auth.roleField}: true,
            },
          });
          const passwordMatches = await verifyPassword(
            password,
            user?.${auth.passwordField} ?? "",
          );
          if (
            !user ||
            !passwordMatches ||
            String(user.${auth.roleField}) !== "ADMIN"
          ) {
            redirect("/admin/login?error=invalid");
          }

          const cookieStore = await cookies();
          cookieStore.set(
            SWITCHBOARD_SESSION_COOKIE,
            createSessionToken(String(user.${auth.idField})),
            sessionCookieOptions(),
          );
          redirect("/admin");
        }
      `,
    },
    {
      path: loginPagePath,
      content: `
        // ${GENERATED_FILE_MARKER}
        import { login } from "${importPath(layout, loginPagePath, actionsPath)}";

        type LoginPageProps = {
          searchParams: Promise<Record<string, string | string[] | undefined>>;
        };

        export default async function LoginPage({
          searchParams,
        }: LoginPageProps) {
          const params = await searchParams;
          const error = typeof params.error === "string" ? params.error : "";

          return (
            <main className="sb-login-card sb-card">
              <div>
                <p className="sb-eyebrow">Switchboard</p>
                <h1 className="sb-page-title">Admin login</h1>
                <p className="sb-page-description">
                  Sign in with an administrator account.
                </p>
              </div>
              {error ? (
                <p className="sb-login-error" role="alert">
                  {error === "missing"
                    ? "Enter your ${auth.credentialField} and password."
                    : "Invalid credentials or administrator access is required."}
                </p>
              ) : null}
              <form action={login} className="sb-form sb-login-form">
                <label className="sb-form-field">
                  <span className="sb-form-label">${auth.credentialField === "email" ? "Email" : "Username"}</span>
                  <input
                    autoComplete="username"
                    autoFocus
                    className="sb-form-control"
                    name="credential"
                    required
                    type="${auth.credentialField === "email" ? "email" : "text"}"
                  />
                </label>
                <label className="sb-form-field">
                  <span className="sb-form-label">Password</span>
                  <input
                    autoComplete="current-password"
                    className="sb-form-control"
                    name="password"
                    required
                    type="password"
                  />
                </label>
                <div className="sb-form-actions">
                  <button className="sb-button" type="submit">
                    Sign in
                  </button>
                </div>
              </form>
            </main>
          );
        }
      `,
    },
    {
      path: logoutRoutePath,
      content: `
        // ${GENERATED_FILE_MARKER}
        import { NextRequest, NextResponse } from "next/server";

        import {
          sessionCookieOptions,
          SWITCHBOARD_SESSION_COOKIE,
        } from "${importPath(layout, logoutRoutePath, authPath)}";

        export function GET(request: NextRequest) {
          const response = NextResponse.redirect(
            new URL("/admin/login", request.url),
          );
          response.cookies.set(SWITCHBOARD_SESSION_COOKIE, "", {
            ...sessionCookieOptions(),
            maxAge: 0,
          });
          return response;
        }
      `,
    },
    {
      path: middlewarePath,
      securityCritical: true,
      content: `
        // ${GENERATED_FILE_MARKER}
        import { NextRequest, NextResponse } from "next/server";

        const COOKIE_NAME = "switchboard_session";
        const LOGIN_PATH = "/admin/login";

        function sessionSecret() {
          const secret = process.env.SWITCHBOARD_SESSION_SECRET;
          if (!secret || secret.length < 32) {
            throw new Error(
              "SWITCHBOARD_SESSION_SECRET is required and must be at least 32 characters.",
            );
          }
          return secret;
        }

        function decodeBase64Url(value: string) {
          const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
          const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
          return Uint8Array.from(atob(padded), (character) =>
            character.charCodeAt(0),
          );
        }

        async function hasValidAdminSession(request: NextRequest) {
          const token = request.cookies.get(COOKIE_NAME)?.value;
          if (!token) return false;
          const [payloadValue, signatureValue] = token.split(".");
          if (!payloadValue || !signatureValue) return false;

          try {
            const key = await crypto.subtle.importKey(
              "raw",
              new TextEncoder().encode(sessionSecret()),
              { name: "HMAC", hash: "SHA-256" },
              false,
              ["verify"],
            );
            const validSignature = await crypto.subtle.verify(
              "HMAC",
              key,
              decodeBase64Url(signatureValue),
              new TextEncoder().encode(payloadValue),
            );
            if (!validSignature) return false;

            const payload = JSON.parse(
              new TextDecoder().decode(decodeBase64Url(payloadValue)),
            ) as { role?: string; expiresAt?: number };
            return (
              payload.role === "ADMIN" &&
              typeof payload.expiresAt === "number" &&
              payload.expiresAt > Math.floor(Date.now() / 1000)
            );
          } catch {
            return false;
          }
        }

        export async function middleware(request: NextRequest) {
          sessionSecret();
          const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;
          const isLogoutRoute =
            request.nextUrl.pathname === "/admin/logout";
          const hasSession = await hasValidAdminSession(request);

          if (isLoginPage) {
            if (hasSession) {
              return NextResponse.redirect(new URL("/admin", request.url));
            }
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set("x-switchboard-login-page", "1");
            return NextResponse.next({
              request: { headers: requestHeaders },
            });
          }

          if (isLogoutRoute) {
            return NextResponse.next();
          }

          if (!hasSession) {
            return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
          }

          const requestHeaders = new Headers(request.headers);
          requestHeaders.set("x-switchboard-login-page", "0");
          return NextResponse.next({
            request: { headers: requestHeaders },
          });
        }

        export const config = {
          matcher: ["/admin/:path*"],
        };
      `,
    },
  ];
}
