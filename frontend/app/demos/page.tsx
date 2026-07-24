import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, MessageCircleQuestion, Sparkles, Trophy } from "lucide-react";
import { championDemos } from "@/src/lib/data/championDemos";

const difficultyLabels = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
};

export default function DemosPage() {
  return (
    <main className="demo-library-shell">
      <header className="review-header">
        <Link className="back-link" href="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
        <Link className="brand training-brand" href="/"><span className="brand-mark">S</span><span>SheSells</span></Link>
        <div className="session-title"><strong>销冠示范</strong><span>先看标杆怎么接话</span></div>
      </header>

      <section className="demo-library-hero">
        <div>
          <span className="panel-kicker">CHAMPION DEMOS</span>
          <h1>先看一段高手对话，再决定自己要练哪里。</h1>
          <p>每个示范都包含顾客真实顾虑、销冠 BA 回应和教练讲解。第一次使用建议先从这里开始，但你也可以按当下训练需求自由选择。</p>
        </div>
        <div className="demo-library-guide" aria-label="入口说明">
          <span><Eye size={16} />先看标杆</span>
          <span><MessageCircleQuestion size={16} />理解顾虑</span>
          <span><Trophy size={16} />迁移技巧</span>
        </div>
      </section>

      <section className="demo-card-grid" aria-label="销冠示范案例">
        {championDemos.map((demo, index) => (
          <Link className="demo-card" href={`/demos/${demo.id}`} key={demo.id}>
            <div className="demo-card-top">
              <span className="demo-index">0{index + 1}</span>
              <span className="demo-score"><Trophy size={15} />{demo.overallScore}</span>
            </div>
            <div className="demo-card-main">
              <span className="demo-difficulty">{difficultyLabels[demo.difficulty]}</span>
              <h2>{demo.title}</h2>
              <p>{demo.scenario}</p>
            </div>
            <div className="demo-tags">
              {demo.skillTags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <div className="demo-card-footer">
              <span><Sparkles size={14} />{demo.recommendedFor}</span>
              <ArrowRight size={17} />
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

