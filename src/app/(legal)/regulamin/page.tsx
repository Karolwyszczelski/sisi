import { ORDER_TERMS_BODY, ORDER_TERMS_VERSION } from "@/config/termsSnapshot";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin – SISI Burger & Pancakes",
  description: "Regulamin korzystania z serwisu i składania zamówień w SISI Burger & Pancakes.",
  alternates: { canonical: "/regulamin" },
  robots: { index: true, follow: true },
};

export default function RegulaminPage() {
  return (
    <LegalPageLayout title="Regulamin" icon="terms" version={ORDER_TERMS_VERSION} effectiveDate={ORDER_TERMS_VERSION}>
      {ORDER_TERMS_BODY.split("\n").filter(Boolean).map((line) =>
        line.startsWith("§") ? <h2 key={line}>{line}</h2> : <p key={line}>{line}</p>
      )}
    </LegalPageLayout>
  );
}
