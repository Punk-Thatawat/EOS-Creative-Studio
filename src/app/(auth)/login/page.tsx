import { redirect } from "next/navigation";

export const metadata = { title: "Log in" };

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authError = Array.isArray(params.auth_error) ? params.auth_error[0] : params.auth_error;
  redirect(authError === "1" ? "/?auth_error=1" : "/?login=1");
}
