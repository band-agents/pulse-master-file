/**
 * Results.
 *
 * The screen this system is most able to do harm with, so it is the most
 * conservative one in the application.
 *
 * A number released to a patient with no interpretation is not transparency,
 * it is an unanswered question delivered at an hour when nobody is available
 * to answer it. So results are released in three states:
 *
 *   normal     — shown in full, plainly labelled as within the usual range
 *   review     — shown in full, with the fact that a clinician is looking
 *   with_team  — NOT shown; the patient is told their team has it and why
 *
 * The third case covers anything critical and anything not yet verified by
 * the laboratory. Withholding a critical figure is not paternalism about the
 * number: it is that the patient cannot act on it, the clinician has already
 * been paged, and a phone call is on its way that the screen would pre-empt
 * with no context.
 */

import { FlaskConical, CircleCheck, Eye, Phone } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { usePortal, type PortalResult } from "../usePortal";
import { PortalPage } from "../PortalApp";
import { cardCls, serif, LoadingRow, EmptyState, fmtDate } from "@/platform/ui";

export default function Results() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { patient, results, loading } = usePortal();

  if (loading || !patient) {
    return <PortalPage><LoadingRow label="Loading your results" labelAr="جاري تحميل نتائجك" /></PortalPage>;
  }

  return (
    <PortalPage>
      <header>
        <h1 className="text-display font-semibold text-foreground" style={serif}>
          {ar ? "نتائج فحوصك" : "Your test results"}
        </h1>
        <p className="text-body-lg text-muted-foreground mt-1">
          {ar
            ? "تظهر النتائج هنا بعد أن يعتمدها المختبر."
            : "Results appear here once the laboratory has verified them."}
        </p>
      </header>

      {results.length === 0 ? (
        <div className={cardCls}>
          <EmptyState
            icon={FlaskConical}
            title="No results yet"
            titleAr="لا نتائج بعد"
            hint="When a test is done and checked, it appears here and your care team sees it at the same moment."
            hintAr="عند إجراء الفحص واعتماده يظهر هنا، ويراه فريق الرعاية في اللحظة نفسها."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r) => <ResultCard key={r.id} result={r} />)}
        </div>
      )}

      <p className="text-caption text-muted-foreground text-center pb-4 max-w-[54ch] mx-auto">
        {ar
          ? "إن كان لديك قلق بشأن أي نتيجة، راسل فريق الرعاية. وإن كنت تشعر بتوعك شديد الآن، اتصل بالطوارئ ولا تنتظر رداً."
          : "If a result worries you, message your care team. If you feel seriously unwell right now, call emergency services rather than waiting for a reply."}
      </p>
    </PortalPage>
  );
}

function ResultCard({ result }: { result: PortalResult }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const header = {
    normal: {
      icon: CircleCheck,
      wrap: "bg-success/12 text-success",
      title: ar ? "ضمن المعدل الطبيعي" : "Within the usual range",
      body: ar
        ? "لا يحتاج هذا الفحص إلى إجراء منك."
        : "Nothing here needs action from you.",
    },
    review: {
      icon: Eye,
      wrap: "bg-warning/15 text-warning",
      title: ar ? "بعض القيم خارج المعدل" : "Some values are outside the usual range",
      body: ar
        ? "طبيبك يرى هذه النتيجة أيضاً. كثير من القيم تخرج عن المعدل قليلاً دون أن تعني وجود مشكلة."
        : "Your doctor can see this too. Many values sit slightly outside the range without meaning anything is wrong.",
    },
    with_team: {
      icon: Phone,
      wrap: "bg-info/12 text-info",
      title: ar ? "فريق الرعاية يراجع هذه النتيجة" : "Your care team is reviewing this",
      body: ar
        ? "أُبلغ الفريق بهذه النتيجة وسيتواصل معك. لا نعرض الأرقام هنا لأن قراءتها دون شرح قد تكون مضللة."
        : "They have been notified and will contact you. The numbers are not shown here because reading them without an explanation is more misleading than helpful.",
    },
  }[result.release];

  const Icon = header.icon;

  return (
    <article className={cardCls}>
      <div className="p-4 flex items-start gap-3">
        <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${header.wrap}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold text-foreground" style={serif}>
            {result.panel}
          </h2>
          <p className="text-caption text-muted-foreground mt-0.5">{fmtDate(result.at, ar)}</p>
          <p className="text-body-lg text-foreground mt-2 font-medium">{header.title}</p>
          <p className="text-body text-muted-foreground mt-1 leading-relaxed">{header.body}</p>
        </div>
      </div>

      {result.lines.length > 0 && (
        <div className="border-t border-border/30">
          <table className="w-full">
            <tbody className="divide-y divide-border/20">
              {result.lines.map((line, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-body text-foreground">{line.analyte}</td>
                  <td className="px-4 py-2 text-body font-medium text-foreground text-end tabular-nums font-mono whitespace-nowrap">
                    {line.value}{line.unit ? ` ${line.unit}` : ""}
                  </td>
                  <td className="px-4 py-2 text-end w-[130px]">
                    <span className={`text-micro font-medium ${line.normal ? "text-success" : "text-warning"}`}>
                      {line.normal
                        ? (ar ? "طبيعي" : "usual range")
                        : (ar ? "خارج المعدل" : "outside range")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
