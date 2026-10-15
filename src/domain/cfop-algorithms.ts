import { catalogMatches, type CatalogMatch } from "./cfop-algorithm-matches";
import { cfopProgress, type CFOPAnalysis } from "./cfop-analysis";
import type { CFOPCase } from "./cfop-pairs";
import { FACES, normals } from "./cube";
import { COLOR_FACE } from "./cross";
import type { TimedResult } from "./timed-attempt";

interface Section {
  start: number;
  solution: number;
  end: number;
  match?: CatalogMatch;
}

/** Named algorithms supplement state progress; unmatched traces retain timing. */
export function analyzeLLAlgorithms(
  result: TimedResult,
  analysis: CFOPAnalysis,
): CFOPCase[] {
  const moves = result.rawTurns!.map((turn) => turn.move);
  const axis = normals[FACES.indexOf(COLOR_FACE[analysis.crossColor])];
  const top =
    FACES[
      normals.findIndex((normal) =>
        normal.every((value, i) => value === -axis[i]),
      )
    ];
  const matches = catalogMatches(moves, analysis.crossColor);
  const progress = analysis.states.map((state) =>
    cfopProgress(state, analysis.crossColor),
  );
  const time = (index: number) =>
    index === 0
      ? 0
      : index === moves.length
        ? result.rawDurationMs
        : analysis.moveTimesMs[index - 1];
  const solutionStart = (start: number, end: number) => {
    let index = start;
    // The selected holding's U face is opposite the inferred cross color.
    while (
      index + 1 < end &&
      moves[index][0] === top &&
      moves[index + 1][0] === top &&
      !moves[index].endsWith("2") &&
      !moves[index + 1].endsWith("2") &&
      moves[index] !== moves[index + 1]
    )
      index += 2;
    return index;
  };
  const output: CFOPCase[] = [];
  for (const phase of analysis.phases) {
    if (
      (phase.phase !== "OLL" && phase.phase !== "PLL") ||
      phase.startIndex === phase.endIndex
    )
      continue;
    const phaseName = phase.phase;
    let start = phase.startIndex;
    let sections: Section[] = [];
    while (start < phase.endIndex) {
      const solution = solutionStart(start, phase.endIndex);
      const available = matches.filter(
        (match) =>
          match.startIndex === solution &&
          match.endIndex <= phase.endIndex &&
          match.case.phase === phaseName &&
          progress[match.endIndex][phaseName === "OLL" ? "f2l" : "oll"],
      );
      // A direct full algorithm wins over one of its shorter known prefixes.
      available.sort(
        (a, b) =>
          b.endIndex - a.endIndex || (a.case.look === "one-look" ? -1 : 1),
      );
      const match = available[0];
      if (!match) {
        if (
          phaseName === "PLL" &&
          sections.length &&
          moves.slice(start, phase.endIndex).every((move) => move[0] === top)
        ) {
          sections.at(-1)!.end = phase.endIndex;
          break;
        }
        // Unsupported catalog splits do not manufacture extra attempts. A
        // restored edge-orientation state remains an independent two-look seam.
        const edgeBoundary =
          phaseName === "OLL" && !progress[phase.startIndex].eo
            ? progress.findIndex(
                (value, index) =>
                  index > phase.startIndex &&
                  index < phase.endIndex &&
                  value.eo &&
                  !value.oll,
              )
            : -1;
        const boundaries =
          edgeBoundary < 0
            ? [phase.startIndex, phase.endIndex]
            : [phase.startIndex, edgeBoundary, phase.endIndex];
        sections = boundaries.slice(0, -1).map((from, i) => {
          const end = boundaries[i + 1],
            solution = solutionStart(from, end);
          const match = matches.find(
            (candidate) =>
              candidate.startIndex === solution &&
              candidate.endIndex === end &&
              candidate.case.phase === phaseName,
          );
          return { start: from, solution, end, match };
        });
        break;
      }
      sections.push({ start, solution, end: match.endIndex, match });
      start = match.endIndex;
    }
    const twoLook =
      phaseName === "OLL" &&
      sections.length > 1 &&
      !progress[phase.startIndex].eo &&
      sections.some(
        (section) => progress[section.end].eo && !progress[section.end].oll,
      );
    sections.forEach((section, i) => {
      let matched = section.match;
      if (twoLook && matched) {
        matched =
          matches.find(
            (match) =>
              match.startIndex === section.solution &&
              match.endIndex === section.end &&
              match.case.look === "two-look" &&
              match.case.phase === "OLL",
          ) ?? matched;
      }
      const name =
        matched?.case.name ??
        (twoLook
          ? `Unrecognized (${i === 0 ? "edges" : "corners"})`
          : "Unrecognized");
      const startMs = time(section.start),
        endMs = time(section.end);
      const alignmentOnly =
        phaseName === "PLL" &&
        section.solution === section.start &&
        moves
          .slice(section.start, section.end)
          .every((move) => move[0] === top);
      const executionStartMs = alignmentOnly
        ? startMs
        : section.solution === section.end
          ? endMs
          : analysis.moveTimesMs[section.solution];
      output.push({
        id: `${phaseName.toLowerCase()}-${i + 1}`,
        phase: phaseName,
        label: `${phaseName} - ${name}`,
        startIndex: section.start,
        solutionStartIndex: section.solution,
        endIndex: section.end,
        startMs,
        executionStartMs,
        endMs,
        recognitionMs: Math.max(0, executionStartMs - startMs),
        executionMs: Math.max(0, endMs - executionStartMs),
        ...(matched
          ? { catalogCaseId: matched.case.id, variantId: matched.variant.id }
          : {}),
      });
    });
  }
  return output;
}
