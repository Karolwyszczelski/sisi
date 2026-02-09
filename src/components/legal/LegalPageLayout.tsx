"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Shield, Cookie, Calendar, Building, Mail, Phone } from "lucide-react";
import { LEGAL } from "@/config/legal";

interface LegalPageLayoutProps {
  title: string;
  icon: "terms" | "privacy" | "cookies";
  children: React.ReactNode;
}

const iconMap = {
  terms: FileText,
  privacy: Shield,
  cookies: Cookie,
};

const colorMap = {
  terms: "from-yellow-400 to-amber-500",
  privacy: "from-blue-400 to-indigo-500",
  cookies: "from-green-400 to-emerald-500",
};

export default function LegalPageLayout({ title, icon, children }: LegalPageLayoutProps) {
  const Icon = iconMap[icon];
  const gradient = colorMap[icon];

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-white">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Header */}
      <header className="relative pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="max-w-4xl mx-auto px-6">
          {/* Back Button */}
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Powrót do strony głównej</span>
          </Link>

          {/* Title Section */}
          <div className="flex items-center gap-4 md:gap-6">
            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl shadow-${icon === 'terms' ? 'yellow' : icon === 'privacy' ? 'blue' : 'green'}-500/20`}>
              <Icon size={32} className="text-white md:hidden" />
              <Icon size={40} className="text-white hidden md:block" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white mb-1">{title}</h1>
              <div className="flex items-center gap-3 text-white/50 text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  Wersja: {LEGAL.docsVersion}
                </span>
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span>od {LEGAL.effectiveDate}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="relative max-w-4xl mx-auto px-6 pb-16">
        <article className="bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl">
          {/* Article Content */}
          <div className="prose prose-invert prose-lg max-w-none
            prose-headings:text-white prose-headings:font-bold
            prose-h2:text-xl prose-h2:md:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/10
            prose-p:text-white/80 prose-p:leading-relaxed
            prose-li:text-white/80 prose-li:marker:text-yellow-400
            prose-ul:space-y-2
            prose-ol:space-y-2
            prose-a:text-yellow-400 prose-a:no-underline hover:prose-a:text-yellow-300 hover:prose-a:underline
            prose-strong:text-white prose-strong:font-semibold
            prose-hr:border-white/10 prose-hr:my-10
          ">
            {children}
          </div>
        </article>

        {/* Company Info Card */}
        <div className="mt-8 bg-white/[0.03] border border-white/10 rounded-2xl p-6 md:p-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building size={20} className="text-yellow-400" />
            Dane administratora
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <p className="text-white/80">
                <span className="text-white font-medium">{LEGAL.legalName}</span>
              </p>
              <p className="text-white/60">
                NIP: {LEGAL.nip} · REGON: {LEGAL.regon}
              </p>
              <p className="text-white/60">
                {LEGAL.registeredAddress}
              </p>
            </div>
            <div className="space-y-3">
              <a 
                href={`mailto:${LEGAL.email}`}
                className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                <Mail size={16} />
                {LEGAL.email}
              </a>
              <a 
                href={`tel:${LEGAL.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                <Phone size={16} />
                {LEGAL.phone}
              </a>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link 
            href="/regulamin"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/70 hover:text-white transition-all"
          >
            <FileText size={14} />
            Regulamin
          </Link>
          <Link 
            href="/polityka-prywatnosci"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/70 hover:text-white transition-all"
          >
            <Shield size={14} />
            Polityka prywatności
          </Link>
          <Link 
            href="/cookies"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/70 hover:text-white transition-all"
          >
            <Cookie size={14} />
            Polityka cookies
          </Link>
        </div>
      </div>
    </main>
  );
}
