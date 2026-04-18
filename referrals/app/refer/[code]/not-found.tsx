import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <section className="px-6 py-24">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl mb-4">Link not found.</h1>
          <p className="text-lg opacity-80 mb-8">
            This referral link isn&apos;t active. Maybe it expired, or the code was
            mistyped. Call us directly and we&apos;ll sort it out.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="tel:4692142013" className="btn btn-primary">
              Call (469) 214-2013
            </a>
            <Link href="/" className="btn btn-secondary">
              Learn about the program
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
