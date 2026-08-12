import { useMemo, useState } from "react";
import { Clipboard, RotateCcw, Ruler } from "lucide-react";
import { Button } from "../components/ui";
import { useToast } from "../components/Toast";
import { calculateStringLength } from "../core/stringLength";
import { translate as t } from "../i18n";

const DEFAULT_TEXT = "Hi:你好！ 猜猜我有多长？";

export function StringLengthPage() {
  const { notify } = useToast();
  const [text, setText] = useState(DEFAULT_TEXT);
  const stats = useMemo(() => calculateStringLength(text), [text]);
  const resultItems = [
    { label: t("文本总长1（不含换行）"), value: stats.weightedLength },
    { label: t("文本总长2（不含换行，不区分全/半角）"), value: stats.characterCount },
    { label: t("中文字符"), value: stats.chinese },
    { label: t("字母字符"), value: stats.letters },
    { label: t("数字字符"), value: stats.numbers },
    { label: t("空格数"), value: stats.spaces },
    { label: t("半角字符"), value: stats.halfWidth },
    { label: t("全角字符"), value: stats.fullWidth },
    { label: t("换行数"), value: stats.lineBreaks },
    { label: t("总行数"), value: stats.lineCount },
  ];

  const copyResult = async (value: number) => {
    try {
      await navigator.clipboard.writeText(String(value));
      notify(t("结果已复制"));
    } catch {
      notify(t("复制失败，请手动复制"), "error");
    }
  };

  return (
    <div className="tool-page string-length-page">
      <header className="string-length-header">
        <div>
          <span className="eyebrow">{t("文本工具")}</span>
          <h1>{t("字符串长度计算")}</h1>
          <p>{t("实时统计半角、全角、中文、字母、数字、空格和行数。")}</p>
        </div>
        <Ruler aria-hidden="true" />
      </header>

      <div className="string-length-grid">
        <section className="string-length-input-card">
          <div className="section-heading compact">
            <div><span className="eyebrow">{t("输入")}</span><h2>{t("待计算文本")}</h2></div>
            <div className="toolbar-group">
              <Button size="small" onClick={() => setText(DEFAULT_TEXT)}><RotateCcw />{t("示例")}</Button>
              <Button size="small" variant="danger" onClick={() => setText("")}>{t("清除")}</Button>
            </div>
          </div>
          <textarea
            className="string-length-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("请输入需要统计的文本…")}
            spellCheck={false}
            aria-label={t("待计算文本")}
          />
        </section>

        <section className="string-length-results" aria-label={t("统计结果")}>
          <div className="section-heading compact">
            <div><span className="eyebrow">{t("实时结果")}</span><h2>{t("统计结果")}</h2></div>
            <span>{t("点击数值即可复制")}</span>
          </div>
          <div className="string-length-result-grid">
            {resultItems.map((item, index) => (
              <button
                className={`string-length-result ${index < 2 ? "primary" : ""}`}
                key={item.label}
                onClick={() => void copyResult(item.value)}
                aria-label={`${t("复制")} ${item.label}: ${item.value}`}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <Clipboard aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="string-length-rules">
        <div><span className="eyebrow">{t("计算规则")}</span><h2>{t("长度口径")}</h2></div>
        <ol>
          <li>{t("一个半角字符算 1 个长度。")}</li>
          <li>{t("汉字和全角字符算 2 个长度。")}</li>
          <li>{t("换行符归属于半角，但不计入两种总长。")}</li>
          <li>{t("Windows 的 CRLF 按一个换行符统计。")}</li>
        </ol>
      </section>
    </div>
  );
}