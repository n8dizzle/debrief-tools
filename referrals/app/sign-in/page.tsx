import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SignInForm from "./SignInForm";

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <section className="px-6 pt-16 pb-24">
        <div className="max-w-md mx-auto">
          <h1 className="text-5xl text-center mb-4">Sign in</h1>
          <p className="opacity-80 text-center mb-10">
            We&apos;ll email you a one-click link to your dashboard.
          </p>
          <SignInForm />
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
