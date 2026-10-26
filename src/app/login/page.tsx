import { LoginForm } from "@/components/LoginForm";
import { signIn, signUp } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <LoginForm signIn={signIn} signUp={signUp} error={error} info={info} />
    </main>
  );
}
