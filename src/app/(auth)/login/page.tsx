import { redirect } from "next/navigation";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  redirect("/?login=1");
}
