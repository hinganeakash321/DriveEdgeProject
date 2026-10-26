import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — DriveEdge",
  description: "How DriveEdge collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <LegalSection title="1. Overview">
        DriveEdge (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps you discover cars, compare specifications,
        and collect competitive on-road quotations from dealerships across India. This policy explains
        what information we collect and how we use it. By using DriveEdge you agree to the practices
        described here.
      </LegalSection>
      <LegalSection title="2. Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account details</strong> — your name, email address, and role (customer or dealer).</li>
          <li><strong>Enquiry data</strong> — the vehicles you enquire about, your preferred location, and messages you send to dealers.</li>
          <li><strong>Usage data</strong> — pages viewed, searches, and interactions, used to improve recommendations.</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. How we use your information">
        We use your information to route enquiries to the relevant dealerships, generate AI-assisted
        recommendations, show you quotation comparisons, and operate and improve the service. We do not
        sell your personal information.
      </LegalSection>
      <LegalSection title="4. Sharing with dealers">
        When you request quotations, the dealerships you select receive the enquiry details needed to
        respond (vehicle, variant, location, and your message). Dealers may contact you about your enquiry.
      </LegalSection>
      <LegalSection title="5. Data retention & security">
        We retain your data for as long as your account is active or as needed to provide the service.
        We apply reasonable technical and organisational measures to protect your information.
      </LegalSection>
      <LegalSection title="6. Your rights">
        You may access, correct, or delete your account data at any time from your dashboard, or by
        contacting us at <a className="text-brand hover:underline" href="mailto:privacy@driveedge.in">privacy@driveedge.in</a>.
      </LegalSection>
      <LegalSection title="7. Contact">
        Questions about this policy? Email <a className="text-brand hover:underline" href="mailto:privacy@driveedge.in">privacy@driveedge.in</a>.
      </LegalSection>
    </LegalPage>
  );
}
