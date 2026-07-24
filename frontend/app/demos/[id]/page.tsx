import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck, Bot, ClipboardList, Lightbulb, Sparkles } from "lucide-react";
import { MessageBubble } from "@/components/MessageBubble";
import type { Message } from "@/src/types";
import { championDemos, getChampionDemo } from "@/src/lib/data/championDemos";

const difficultyLabels = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
};

export function generateStaticParams() {
  return championDemos.map((demo) => ({ id: demo.id }));
}

export default async function DemoWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const demo = getChampionDemo(id);

  if (!demo) notFound();

  return (
    <main className="demo-watch-shell">
      <header className="review-header">
        <Link className="back-link" href="/demos" aria-label="返回示范列表"><ArrowLeft size={18} /></Link>
        <Link className="brand training-brand" href="/"><span className="brand-mark">S</span><span>SheSells</span></Link>
        <div className="session-title"><strong>观看示范</strong><span>{demo.title}</span></div>
        <Link className="review-restart" href="/training/new"><Sparkles size={16} />去训练</Link>
      </header>

      <section className="demo-watch-layout">
        <aside className="demo-watch-summary">
          <span className="panel-kicker">DEMO BRIEF</span>
          <h1>{demo.title}</h1>
          <p>{demo.scenario}</p>

          <div className="demo-persona-card">
            <div className="persona-row">
              <div className="persona-avatar">{demo.persona.name.slice(0, 1)}</div>
              <div className="persona-copy">
                <h2>{demo.persona.name}</h2>
                <div className="persona-tags">
                  <span>{demo.persona.skinType}</span>
                  <span>{difficultyLabels[demo.difficulty]}</span>
                </div>
              </div>
            </div>
            <p>{demo.persona.background}</p>
          </div>

          <div className="demo-inline-highlights">
            <div className="review-panel-head"><Lightbulb size={18} /><h2>本案例亮点</h2></div>
            <ul>
              {demo.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
            </ul>
          </div>

          <div className="demo-next-inline">
            <div className="review-panel-head"><Sparkles size={18} /><h2>看完可以继续</h2></div>
            <p>手上有没接住的真实对话时，直接进入案例复盘，把亮点迁移到自己的场景里。</p>
            <Link className="conversation-review-action" href="/case-review"><ClipboardList size={15} />复盘我的案例</Link>
          </div>

          <div className="demo-tags is-summary">
            {demo.skillTags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        </aside>

        <section className="demo-watch-main">
          <div className="conversation-head">
            <div><BookOpenCheck size={18} /><span>示范对话</span></div>
            <p>只读观看</p>
          </div>
          <div className="chat-scroll demo-watch-scroll" aria-label="销冠示范对话">
            <div className="chat-day"><span>销冠示范</span></div>
            {demo.messages.map((message) => (
              <DemoMessageBubble key={message.id} message={message} />
            ))}
          </div>
        </section>

      </section>
    </main>
  );
}

function DemoMessageBubble({ message }: { message: Message }) {
  if (message.role === "coach") {
    return (
      <article className="coach-card coach-feedback">
        <div className="coach-card-bar" />
        <div className="coach-card-body">
          <div className="coach-card-head">
            <span className="coach-icon"><Bot size={18} /></span>
            <div><span>回答亮点</span></div>
          </div>
          <p className="coach-content">{message.content}</p>
        </div>
      </article>
    );
  }

  return (
    <MessageBubble
      baLabel="销冠 BA"
      customerLabel="顾客"
      message={message}
    />
  );
}
