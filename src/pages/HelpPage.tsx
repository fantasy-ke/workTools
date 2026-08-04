import { useState, type ReactNode } from "react";
import {
  Braces,
  CalendarClock,
  ChevronRight,
  FileDown,
  FolderKanban,
  Layers3,
  Lightbulb,
  ListChecks,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { translate as t } from "../i18n";

interface HelpField {
  label: string;
  setting: string;
  meaning: string;
}

interface HelpTopic {
  id: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  summary: string;
  steps: string[];
  fields: HelpField[];
  tips: string[];
}

function createTopics(): HelpTopic[] {
  return [
  {
    id: "quick-start",
    icon: <Layers3 />,
    eyebrow: t("入门"),
    title: t("快速开始"),
    summary: t("从导入报文到保存工作区，熟悉最常用的操作路径。"),
    steps: [
      t("在左侧选择“格式化”或“对比”；双击这两个菜单可新建一个独立的未命名标签。"),
      t("粘贴报文或点击“打开文件”，工具会在本地识别 JSON、XML 或文本格式。"),
      t("完成处理后点击“保存工作区”，也可以按 Ctrl + S 直接保存当前内容。"),
      t("从“工作区”打开已保存内容时，会创建带有文件名称的新标签，不会覆盖当前任务。"),
    ],
    fields: [
      { label: t("格式"), setting: t("选择“自动识别”，或明确指定 JSON / XML / 文本。"), meaning: t("指定解析器，明确格式时可以减少错误识别。") },
      { label: t("双击菜单"), setting: t("双击“格式化”或“对比”。"), meaning: t("新建独立标签，适合同时处理多组报文。") },
      { label: "Ctrl + S", setting: t("当前标签有内容时直接按快捷键。"), meaning: t("把当前格式化或对比任务保存到本地工作区。") },
    ],
    tips: [t("所有报文默认只在本机处理。"), t("关闭标签前先保存，未保存内容不会自动进入工作区。")],
  },
  {
    id: "rule-templates",
    icon: <ListChecks />,
    eyebrow: t("对比规则"),
    title: t("添加与加载规则模板"),
    summary: t("把经常使用的数组、路径和类型规则保存下来，一键复用。"),
    steps: [
      t("进入“对比”，点击工具栏中的“高级选项”。"),
      t("设置数组处理、忽略路径、仅比较路径和其他规则，然后关闭高级选项面板。"),
      t("点击“保存规则”，输入容易识别的模板名称。"),
      t("下次在“加载规则模板”下拉框中选择该名称，当前对比规则会立即替换为模板内容。"),
      t("需要删除模板时，进入“工作区”的“对比规则”分类进行管理。"),
    ],
    fields: [
      { label: t("加载规则模板"), setting: t("从下拉框选择已保存模板。"), meaning: t("一次恢复整组高级对比设置。") },
      { label: t("保存规则"), setting: t("先配置高级选项，再点击并输入名称。"), meaning: t("保存当前规则，不保存左右报文内容。") },
      { label: t("模板名称"), setting: t("建议使用“供应商-接口-用途”，例如“ABC-下单-忽略时间”。"), meaning: t("方便在模板较多时快速定位。") },
    ],
    tips: [t("加载模板会替换当前高级设置，建议先保存仍需保留的规则。"), t("规则模板存储在本机，可随工作区备份一起导出。")],
  },
  {
    id: "advanced-diff",
    icon: <Settings2 />,
    eyebrow: t("高级设置"),
    title: t("高级对比设置详解"),
    summary: t("了解每个 label 的设置方式和实际影响，减少无意义差异。"),
    steps: [
      t("先选择“对比模式”，通常 API 报文使用“语义对比”。"),
      t("展开“高级选项”，按接口实际规则调整下面的字段。"),
      t("点击“开始对比”，观察差异数量和路径；规则过宽时再逐项收紧。"),
    ],
    fields: [
      { label: t("数组处理"), setting: t("顺序比较 / 忽略顺序 / 按关键字段匹配。"), meaning: t("决定数组元素是按位置、内容集合，还是业务主键进行配对。") },
      { label: t("数组关键字段"), setting: t("数组处理选择“按关键字段匹配”后填写，如 id、code。"), meaning: t("用字段值识别同一个数组元素，避免顺序变化产生大量差异。") },
      { label: t("忽略空白差异"), setting: t("开关。"), meaning: t("忽略文本前后空格和部分排版差异。") },
      { label: t("忽略大小写"), setting: t("开关。"), meaning: t("把 ABC 与 abc 视为相同。") },
      { label: t("严格比较类型"), setting: t("开关。"), meaning: t("开启后，数字 1 与字符串“1”会被识别为类型差异。") },
      { label: t("缺失字段等同 null"), setting: t("开关。"), meaning: t("开启后，未返回字段与值为 null 的字段视为相同。") },
      { label: t("忽略路径"), setting: t("每行一个路径，支持 * 和 [*]，如 $.data[*].updateTime。"), meaning: t("这些路径不参与对比，适合时间戳、流水号等动态字段。") },
      { label: t("仅比较路径"), setting: t("每行一个路径，如 $.data.orderId。"), meaning: t("只比较列出的范围，其他内容全部忽略。") },
      { label: t("最大差异数"), setting: t("填写正整数。"), meaning: t("达到数量后停止收集差异，避免超大报文拖慢界面。") },
    ],
    tips: [t("“忽略路径”和“仅比较路径”不要设置成互相冲突的范围。"), t("规则调整后重新点击“开始对比”才会刷新结果。")],
  },
  {
    id: "highlight-export",
    icon: <FileDown />,
    eyebrow: t("结果交付"),
    title: t("高亮查看与导出"),
    summary: t("在编辑器和导出报告中快速定位新增、删除、修改和移动内容。"),
    steps: [
      t("完成对比后，左右编辑器会按差异类型高亮对应位置。"),
      t("在差异列表中点击某条记录，可跳转到报文中的相关位置。"),
      t("点击“导出”，选择 HTML、Markdown、CSV 或 JSON。"),
      t("需要分享真实报文前，可开启“导出时脱敏”并配置脱敏规则。"),
    ],
    fields: [
      { label: t("绿色"), setting: t("无需设置。"), meaning: t("右侧新增的内容。") },
      { label: t("红色"), setting: t("无需设置。"), meaning: t("左侧被删除的内容。") },
      { label: t("黄色"), setting: t("无需设置。"), meaning: t("值或类型发生修改的内容。") },
      { label: t("蓝色"), setting: t("无需设置。"), meaning: t("位置发生移动的内容。") },
      { label: "HTML", setting: t("导出菜单选择 HTML。"), meaning: t("适合直接用浏览器打开，包含左右报文、行号和彩色高亮。") },
      { label: "Markdown", setting: t("导出菜单选择 Markdown。"), meaning: t("适合放入工单或文档，使用 diff 标记突出左右差异行。") },
      { label: "CSV / JSON", setting: t("导出菜单选择对应格式。"), meaning: t("包含差异位置或高亮范围，适合二次处理。") },
      { label: t("导出时脱敏"), setting: t("开启后选择或配置脱敏规则。"), meaning: t("导出前遮盖密码、手机号、令牌等敏感字段。") },
    ],
    tips: [t("对外发送时优先使用 HTML，阅读体验最好。"), t("脱敏后的报文仍会保留差异路径和高亮位置。")],
  },
  {
    id: "workspace",
    icon: <FolderKanban />,
    eyebrow: t("本地管理"),
    title: t("工作区与回收站"),
    summary: t("保存、重新打开、删除和恢复常用报文任务。"),
    steps: [
      t("在格式化、对比或 Cron 页面点击“保存工作区”。"),
      t("进入“工作区”，按类型查找记录并点击打开。"),
      t("点击删除后，记录会先进入回收站，不会立即永久清除。"),
      t("在“回收站”中可以恢复记录，或确认后永久删除。"),
    ],
    fields: [
      { label: t("名称"), setting: t("保存时输入有业务含义的名称。"), meaning: t("同时显示在工作区记录和打开后的标签标题中。") },
      { label: t("置顶"), setting: t("在工作区记录上点击置顶。"), meaning: t("把常用任务保持在列表前方。") },
      { label: t("删除"), setting: t("点击记录的删除操作。"), meaning: t("移动到回收站，仍可恢复。") },
      { label: t("永久删除"), setting: t("在回收站中再次确认删除。"), meaning: t("彻底移除本地记录，无法恢复。") },
    ],
    tips: [t("工作区数据保存在当前设备本地。"), t("更换电脑前，建议在设置中导出完整备份。")],
  },
  {
    id: "cron",
    icon: <CalendarClock />,
    eyebrow: "Cron",
    title: t("Cron 生成与复原"),
    summary: t("在可视化字段和表达式之间双向转换，并检查下一次运行时间。"),
    steps: [
      t("选择与目标系统一致的 Cron 方言：Unix、Spring 或 Quartz。"),
      t("可以直接输入表达式进行复原，也可以通过字段面板生成表达式。"),
      t("选择时区后查看自然语言说明和接下来的运行时间。"),
      t("确认无误后复制表达式，或保存到工作区供后续复用。"),
    ],
    fields: [
      { label: t("Cron 方言"), setting: t("按服务端框架选择 Unix / Spring / Quartz。"), meaning: t("不同方言的字段数量以及秒、年字段支持不同。") },
      { label: t("时区"), setting: t("选择任务实际运行环境的时区。"), meaning: t("影响“下一次运行时间”的计算结果。") },
      { label: t("表达式"), setting: t("粘贴已有表达式或由字段面板生成。"), meaning: t("工具会校验字段并复原为可读说明。") },
      { label: t("下一次运行"), setting: t("表达式有效后自动显示。"), meaning: t("用于确认周期和时区是否符合预期。") },
    ],
    tips: [t("把表达式部署到服务端前，再确认一次服务所使用的 Cron 方言。"), t("跨时区接口任务要以实际部署环境为准。")],
  },
  ];
}

export function HelpPage() {
  const topics = createTopics();
  const [activeId, setActiveId] = useState(topics[0].id);
  const active = topics.find((topic) => topic.id === activeId) ?? topics[0];

  return (
    <div className="page-scroll help-page">
      <header className="help-hero">
        <div>
          <span className="eyebrow">WORKTOOLS GUIDE</span>
          <h1>{t("帮助中心")}</h1>
          <p>{t("从基础操作到高级规则，按真实界面标签逐项说明。")}</p>
        </div>
        <div className="help-hero-badge"><ShieldCheck /><span>{t("本地使用指南")}</span></div>
      </header>

      <div className="help-layout">
        <nav className="help-topic-list" aria-label={t("教程目录")}>
          {topics.map((topic, index) => (
            <button
              key={topic.id}
              type="button"
              className={`help-topic-card ${active.id === topic.id ? "active" : ""}`}
              onClick={() => setActiveId(topic.id)}
              aria-current={active.id === topic.id ? "page" : undefined}
            >
              <span className="help-topic-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="help-topic-icon">{topic.icon}</span>
              <span className="help-topic-copy">
                <strong>{topic.title}</strong>
                <small>{topic.summary}</small>
              </span>
              <ChevronRight className="help-topic-arrow" />
            </button>
          ))}
        </nav>

        <article className="help-detail" key={active.id}>
          <header className="help-detail-header">
            <span className="help-detail-icon">{active.icon}</span>
            <div>
              <span className="eyebrow">{active.eyebrow}</span>
              <h2>{active.title}</h2>
              <p>{active.summary}</p>
            </div>
          </header>

          <section className="help-section">
            <div className="help-section-title"><Save /><h3>{t("操作步骤")}</h3></div>
            <ol className="help-steps">
              {active.steps.map((step, index) => (
                <li key={step}><span>{index + 1}</span><p>{step}</p></li>
              ))}
            </ol>
          </section>

          <section className="help-section">
            <div className="help-section-title"><Braces /><h3>{t("界面标签说明")}</h3></div>
            <div className="help-field-table">
              <div className="help-field-head"><span>Label</span><span>{t("怎么设置")}</span><span>{t("作用与含义")}</span></div>
              {active.fields.map((field) => (
                <div className="help-field-row" key={field.label}>
                  <strong>{field.label}</strong>
                  <span>{field.setting}</span>
                  <span>{field.meaning}</span>
                </div>
              ))}
            </div>
          </section>

          <aside className="help-tips">
            <Lightbulb />
            <div><strong>{t("使用提示")}</strong>{active.tips.map((tip) => <p key={tip}>{tip}</p>)}</div>
          </aside>
        </article>
      </div>
    </div>
  );
}