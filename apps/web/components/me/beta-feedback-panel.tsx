"use client";

import React, { FormEvent, useState } from "react";
import { operationalNotice } from "../../lib/api-client";
import { feedbackCategories, submitBetaFeedback, type FeedbackCategory } from "../../lib/feedback-api";

type BetaFeedbackPanelProps = {
  submit?: typeof submitBetaFeedback;
};

export function BetaFeedbackPanel({ submit = submitBetaFeedback }: BetaFeedbackPanelProps) {
  const [category, setCategory] = useState<FeedbackCategory>("experience");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (content.trim().length < 10) {
      setNotice("请至少填写 10 个字，便于我们定位问题。");
      return;
    }
    setNotice("");
    try {
      await submit({ category, content: content.trim() });
      setContent("");
      setNotice("已收到反馈，感谢你帮助我们改进心屿。");
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法提交反馈，请稍后再试。"));
    }
  };

  return (
    <section className="me-section" aria-labelledby="beta-feedback-heading">
      <h3 id="beta-feedback-heading">封测反馈</h3>
      <p>反馈不会自动附带聊天、记忆或联系方式；请只描述你愿意主动提交的内容。</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <label>问题类型
          <select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}>
            {feedbackCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>反馈内容
          <textarea value={content} onChange={(event) => setContent(event.target.value)} minLength={10} maxLength={2000} rows={4} required />
        </label>
        <button className="quiet-button" type="submit">提交反馈</button>
      </form>
      {notice && <p className="form-message" role="status">{notice}</p>}
    </section>
  );
}
