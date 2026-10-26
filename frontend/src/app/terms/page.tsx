import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions — DriveEdge",
  description: "The terms that govern your use of the DriveEdge platform.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="October 2026">
      <LegalSection title="1. Acceptance of terms">
        By accessing or using DriveEdge, you agree to these Terms &amp; Conditions. If you do not agree,
        please do not use the service.
      </LegalSection>
      <LegalSection title="2. The service">
        DriveEdge is a marketplace that lets customers discover cars, compare specifications, and request
        on-road quotations from participating dealerships. DriveEdge is not a seller of vehicles and is
        not a party to any transaction between you and a dealership.
      </LegalSection>
      <LegalSection title="3. Pricing & quotations">
        Prices, specifications, and quotations shown on DriveEdge are <strong>indicative</strong> and may
        change. Final on-road prices, availability, offers, and delivery timelines are confirmed by the
        dealership. Always verify current details directly with an authorised dealer before purchasing.
      </LegalSection>
      <LegalSection title="4. Accounts">
        You are responsible for maintaining the confidentiality of your account credentials and for all
        activity under your account. Dealer accounts must provide accurate dealership information.
      </LegalSection>
      <LegalSection title="5. Acceptable use">
        You agree not to misuse the service, including submitting false enquiries, scraping data, or
        attempting to disrupt the platform.
      </LegalSection>
      <LegalSection title="6. AI-assisted features">
        DriveEdge uses AI to provide recommendations and summaries based on catalogue data. AI output may
        contain inaccuracies and should not be treated as professional advice. Verify important details
        before making decisions.
      </LegalSection>
      <LegalSection title="7. Limitation of liability">
        The service is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, DriveEdge is
        not liable for any indirect or consequential loss arising from your use of the platform or any
        dealership interaction.
      </LegalSection>
      <LegalSection title="8. Contact">
        Questions about these terms? Email <a className="text-brand hover:underline" href="mailto:support@driveedge.in">support@driveedge.in</a>.
      </LegalSection>
    </LegalPage>
  );
}
