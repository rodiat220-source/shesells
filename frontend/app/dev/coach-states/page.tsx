import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { MessageBubble } from "@/components/MessageBubble";
import { MiniRadar } from "@/components/MiniRadar";
import { coachStateFixtures, demoConversationScript } from "@/src/lib/data/coachStateFixtures";

export default function CoachStatesPage() {
  return (
    <main className="coach-states-shell">
      <header className="coach-states-header">
        <Link className="back-link" href="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
        <div>
          <span>开发预览</span>
          <h1>教练 UI 状态模板</h1>
          <p>用固定假数据检查 probe、feedback、halt、summary 和 champion replay 的前端表现。</p>
        </div>
      </header>

      <section className="demo-script-panel" aria-label="完整演示脚本">
        <div className="demo-script-head">
          <span>完整 Demo 路线</span>
          <p>按顺序输入这些话，可以在一个训练对话里演示 probe、feedback、halt、实时雷达图、summary 和 champion replay。</p>
        </div>
        <div className="demo-script-list">
          {demoConversationScript.map((item) => (
            <article className="demo-script-step" key={item.step}>
              <span>{item.step}</span>
              <strong>{item.userAction}</strong>
              <p>{item.expectedUi}</p>
              <small>{item.note}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="coach-states-grid">
        {coachStateFixtures.map((fixture) => (
          <article className="coach-state-preview" key={fixture.id}>
            <div className="coach-state-meta">
              <div>
                <span>{fixture.title}</span>
                <p>{fixture.description}</p>
              </div>
              {fixture.dimensions && (
                <div className="coach-state-radar">
                  <MiniRadar dimensions={fixture.dimensions} compact />
                </div>
              )}
            </div>

            <dl className="coach-state-script">
              <div><dt>触发话术</dt><dd>{fixture.trigger}</dd></div>
              <div><dt>预期 UI</dt><dd>{fixture.expectedUi}</dd></div>
            </dl>

            <div className="coach-state-chat" aria-label={`${fixture.title} 预览`}>
              {fixture.messages.map((message) => (
                <MessageBubble message={message} forceCoachAction={fixture.isHalted} key={message.id} />
              ))}
              {fixture.isLoading && (
                <div className="thinking-row">
                  <span className="chat-avatar"><UserRound size={17} /></span>
                  <div className="thinking-bubble"><i /><i /><i /></div>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
