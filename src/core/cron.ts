import cronstrue from "cronstrue/i18n";
import { CronExpressionParser } from "cron-parser";
import type { CronAnalysis, CronDialect, CronFieldModel } from "../types";

export const CRON_PRESETS: Record<CronDialect, Array<{ label: string; expression: string }>> = {
  unix: [
    { label: "每 5 分钟", expression: "*/5 * * * *" },
    { label: "每天 09:00", expression: "0 9 * * *" },
    { label: "工作日 09:00", expression: "0 9 * * 1-5" },
  ],
  spring: [
    { label: "每 5 分钟", expression: "0 */5 * * * *" },
    { label: "每天 09:00", expression: "0 0 9 * * *" },
    { label: "工作日 09:00", expression: "0 0 9 * * 1-5" },
  ],
  quartz: [
    { label: "每 5 分钟", expression: "0 */5 * * * ?" },
    { label: "每天 09:00", expression: "0 0 9 * * ?" },
    { label: "工作日 09:00", expression: "0 0 9 ? * MON-FRI" },
  ],
};

export function defaultCronExpression(dialect: CronDialect): string {
  return CRON_PRESETS[dialect][0].expression;
}

export function parseCronFields(expression: string, dialect: CronDialect): CronFieldModel {
  const fields = expression.trim().split(/\s+/).filter(Boolean);
  const expected = dialect === "unix" ? [5] : dialect === "spring" ? [6] : [6, 7];
  if (!expected.includes(fields.length)) {
    const label = expected.length === 1 ? String(expected[0]) : expected.join(" 或 ");
    throw new Error(`${dialect.toUpperCase()} 表达式需要 ${label} 个字段，当前为 ${fields.length} 个`);
  }
  if (dialect === "unix") {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
    return { minute, hour, dayOfMonth, month, dayOfWeek };
  }
  const [second, minute, hour, dayOfMonth, month, dayOfWeek, year] = fields;
  return { second, minute, hour, dayOfMonth, month, dayOfWeek, year };
}

export function buildCronExpression(model: CronFieldModel, dialect: CronDialect): string {
  const common = [model.minute, model.hour, model.dayOfMonth, model.month, model.dayOfWeek];
  if (dialect === "unix") return common.join(" ");
  const fields = [model.second ?? "0", ...common];
  if (dialect === "quartz" && model.year) fields.push(model.year);
  return fields.join(" ");
}

function normalizeForPreview(model: CronFieldModel, dialect: CronDialect): { expression?: string; warnings: string[] } {
  const warnings: string[] = [];
  const allFields = Object.values(model).filter(Boolean).join(" ");
  if (/\b[^\s]*W[^\s]*\b/i.test(allFields)) {
    warnings.push("下次运行时间暂不计算 W（最近工作日）语法；字段说明仍可使用");
    return { warnings };
  }
  if (dialect === "unix" && /[?L#]/i.test(allFields)) {
    warnings.push("Unix 方言不支持 Quartz 的 ?, L, # 特殊字符");
    return { warnings };
  }
  if (dialect === "quartz" && model.year && model.year !== "*") {
    warnings.push("带具体年份的 Quartz 表达式暂不生成运行预览");
    return { warnings };
  }
  const dom = model.dayOfMonth;
  const dow = model.dayOfWeek;
  if (!new Set(["*", "?"]).has(dom) && !new Set(["*", "?"]).has(dow)) {
    warnings.push("日期与星期字段同时受限，不同执行器对二者组合的解释可能不同");
  }
  const normalized = buildCronExpression({ ...model, dayOfMonth: dom === "?" ? "*" : dom, dayOfWeek: dow === "?" ? "*" : dow, year: undefined }, dialect);
  return { expression: normalized, warnings };
}

function fieldDescriptions(model: CronFieldModel, dialect: CronDialect): CronAnalysis["fieldDescriptions"] {
  const values: CronAnalysis["fieldDescriptions"] = [];
  if (dialect !== "unix") values.push({ label: "秒", value: model.second ?? "0" });
  values.push(
    { label: "分", value: model.minute },
    { label: "时", value: model.hour },
    { label: "日", value: model.dayOfMonth },
    { label: "月", value: model.month },
    { label: "周", value: model.dayOfWeek },
  );
  if (dialect === "quartz" && model.year) values.push({ label: "年", value: model.year });
  return values;
}

export function analyzeCron(
  expression: string,
  dialect: CronDialect,
  timezone = "Asia/Shanghai",
  count = 8,
  currentDate = new Date(),
): CronAnalysis {
  const trimmed = expression.trim();
  try {
    const model = parseCronFields(trimmed, dialect);
    const preview = normalizeForPreview(model, dialect);
    const nextRuns: Date[] = [];
    if (preview.expression) {
      const interval = CronExpressionParser.parse(preview.expression, { tz: timezone, currentDate });
      for (let index = 0; index < Math.max(0, Math.min(count, 100)); index += 1) {
        nextRuns.push(interval.next().toDate());
      }
    }
    let description = "表达式有效";
    try {
      description = cronstrue.toString(trimmed, {
        locale: "zh_CN",
        use24HourTimeFormat: true,
        verbose: true,
        throwExceptionOnParseError: true,
      });
    } catch {
      if (preview.expression) {
        try {
          description = cronstrue.toString(preview.expression, {
            locale: "zh_CN",
            use24HourTimeFormat: true,
            verbose: true,
          });
        } catch {
          // 保留通用说明；预览解析已经完成了严格校验。
        }
      }
    }
    return {
      valid: true,
      expression: trimmed,
      dialect,
      model,
      description,
      fieldDescriptions: fieldDescriptions(model, dialect),
      nextRuns,
      warnings: preview.warnings,
    };
  } catch (error) {
    return {
      valid: false,
      expression: trimmed,
      dialect,
      description: "表达式无效",
      fieldDescriptions: [],
      nextRuns: [],
      warnings: [],
      error: error instanceof Error ? error.message : "Cron 表达式解析失败",
    };
  }
}