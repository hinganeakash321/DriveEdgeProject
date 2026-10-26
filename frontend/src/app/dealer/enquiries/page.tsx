"use client";

import { DealerEnquiryList } from "@/components/dealer-enquiry-list";
import { FadeIn } from "@/components/ui";

export default function DealerEnquiriesPage() {
  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-bold text-navy">Assigned Enquiries</h1>
        <p className="mt-1 text-muted">Respond to customer enquiries with a detailed quotation.</p>
      </FadeIn>
      <div className="card mt-6 p-6">
        <DealerEnquiryList />
      </div>
    </div>
  );
}
