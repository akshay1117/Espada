/*
 * Orbit's no-key mentor agent.
 *
 * This is a deterministic, tool-using local agent so the demo runs on GitHub Pages
 * without exposing credentials. Each helper below is an explicit tool call in the
 * planning loop. A future LLM can choose/invoke these same tools server-side; the
 * planner output is validated here before the UI renders it.
 */
(function attachOrbitMentorAgent(global) {
  "use strict";

  const CONFIDENCE_RANK = { learning: 1, comfortable: 2, confident: 3 };
  const CONFIDENCE_FACTOR = { learning: 0.84, comfortable: 0.68, confident: 0 };

  function clampHours(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(20, Math.max(2, numeric)) : 6;
  }

  function run(profileInput, career) {
    if (!career || !Array.isArray(career.skills) || !Array.isArray(career.modules)) {
      throw new Error("A valid career skill map is required.");
    }

    const trace = [];
    const callTool = (tool, action) => {
      const result = action();
      trace.push({ tool, result: result.trace || "Completed" });
      return result;
    };

    // Tool 1 — normalize and inspect the learner's stated starting point.
    const learner = callTool("read_student_profile", () => {
      const supported = new Set(career.skills.map(skill => skill.id));
      const skills = {};
      for (const [id, confidence] of Object.entries(profileInput.skills || {})) {
        if (supported.has(id) && CONFIDENCE_RANK[confidence]) skills[id] = confidence;
      }
      return {
        goal: career.title,
        hours: clampHours(profileInput.hours),
        skills,
        trace: `${career.title} · ${Object.keys(skills).length} skills · ${clampHours(profileInput.hours)} hrs/week`
      };
    });

    // Tool 2 — compare the profile with every skill required by this role.
    const analysis = callTool("analyze_skill_gaps", () => {
      const strong = career.skills.filter(skill => learner.skills[skill.id] === "confident");
      const partial = career.skills.filter(skill => ["learning", "comfortable"].includes(learner.skills[skill.id]));
      const gaps = career.skills.filter(skill => !learner.skills[skill.id]);
      const strongest = [...career.skills]
        .filter(skill => learner.skills[skill.id])
        .sort((a, b) => CONFIDENCE_RANK[learner.skills[b.id]] - CONFIDENCE_RANK[learner.skills[a.id]])[0] || null;
      return {
        strong, partial, gaps, strongest,
        trace: `${strong.length} strong · ${partial.length} in progress · ${gaps.length} new gaps`
      };
    });

    // Tool 3 — keep the role's prerequisite-first sequence, but attach mastery.
    const sequenced = callTool("sequence_learning_path", () => {
      const steps = career.modules.map((module, index) => {
        const confidence = learner.skills[module.skill] || null;
        const factor = confidence ? CONFIDENCE_FACTOR[confidence] : 1;
        const hours = confidence === "confident" ? 0 : Math.max(1, Math.round(module.hours * factor));
        return { ...module, confidence, mastered: confidence === "confident", hours, sequence: index + 1 };
      });
      return { steps, trace: `${steps.length} milestones · prerequisite-first order · mastered skills skipped` };
    });

    // Tool 4 — only use the curated learning resources shipped with the app.
    const resources = callTool("match_curated_resources", () => {
      const steps = sequenced.steps.map(step => {
        let safeUrl = null;
        try {
          const parsed = new URL(step.url);
          if (parsed.protocol === "https:") safeUrl = parsed.href;
        } catch (_) {}
        return { ...step, safeUrl };
      });
      const matched = steps.filter(step => step.safeUrl).length;
      return { steps, trace: `${matched}/${steps.length} curated HTTPS resources matched` };
    });

    // Tool 5 — turn effort estimates into a learner-specific weekly schedule.
    const schedule = callTool("build_weekly_schedule", () => {
      let cursorHours = 0;
      const steps = resources.steps.map(step => {
        if (step.mastered) return { ...step, week: "READY" };
        const startWeek = Math.floor(cursorHours / learner.hours) + 1;
        const endWeek = Math.max(startWeek, Math.ceil((cursorHours + step.hours) / learner.hours));
        cursorHours += step.hours;
        return {
          ...step,
          week: startWeek === endWeek ? `WEEK ${startWeek}` : `WEEKS ${startWeek}–${endWeek}`
        };
      });
      return {
        steps,
        totalHours: cursorHours,
        totalWeeks: cursorHours === 0 ? 0 : Math.ceil(cursorHours / learner.hours),
        trace: `${cursorHours} study hours · ${cursorHours === 0 ? "ready for a stretch project" : `${Math.ceil(cursorHours / learner.hours)} weeks at ${learner.hours} hrs/week`}`
      };
    });

    // Tool 6 — reject incomplete or unsafe plans before displaying them.
    const validated = callTool("validate_roadmap", () => {
      const uniqueSkills = new Set(schedule.steps.map(step => step.skill));
      const valid = schedule.steps.length > 0 &&
        uniqueSkills.size === schedule.steps.length &&
        schedule.steps.every(step => step.title && step.description && step.task && step.safeUrl);
      return {
        valid,
        trace: valid ? `${schedule.steps.length} milestones checked · tasks and HTTPS resources present` : "Plan needs repair before display"
      };
    });

    const insight = buildMentorNote(learner, career, analysis, schedule.steps);
    const summary = {
      learner,
      stepCount: schedule.steps.length,
      masteredCount: analysis.strong.length,
      partialCount: analysis.partial.length,
      gapCount: analysis.gaps.length,
      totalHours: schedule.totalHours,
      totalWeeks: schedule.totalWeeks,
      passedValidation: validated.valid
    };

    return {
      steps: validated.valid ? schedule.steps : [],
      insight,
      summary,
      trace,
      agentMode: "local-tools"
    };
  }

  function buildMentorNote(learner, career, analysis, steps) {
    const firstGap = steps.find(step => !step.confidence);
    if (Object.keys(learner.skills).length === 0) {
      return `You’re starting with a clean slate, so the path begins with ${career.modules[0].title.toLowerCase()} before building toward a portfolio-ready project. ${learner.hours} hours a week keeps the workload realistic.`;
    }
    if (!firstGap) {
      return "You’ve marked every mapped skill as something you know. Orbit has shortened those refreshers and kept the focus on applying what you know. Choose a stretch project or a more advanced target next.";
    }
    const strongest = analysis.strongest;
    const startingPoint = strongest
      ? `Your strongest starting point is ${strongest.name} (${learner.skills[strongest.id]}).`
      : `You have ${analysis.partial.length} skill${analysis.partial.length === 1 ? "" : "s"} in progress to build on.`;
    return `${startingPoint} The clearest next gap is ${firstGap.title}; it gets a hands-on milestone. At ${learner.hours} hours a week, the schedule adapts to your pace.`;
  }

  global.OrbitMentorAgent = Object.freeze({ run });
})(window);
