#!/usr/bin/env node

/**
 * Contributor Insights Generator
 *
 * This script generates a comprehensive markdown report with insights
 * from the contributor data fetched by fetch-contributors.js
 */

const fs = require("fs");
const path = require("path");

class ContributorInsightsGenerator {
  constructor() {
    this.data = null;
    this.outputFile = "CONTRIBUTOR_INSIGHTS.md";
  }

  /**
   * Load contributor data from JSON file
   */
  loadData() {
    try {
      // First try to find the full contributors file (not summary)
      const fullFiles = fs
        .readdirSync(process.cwd())
        .filter(
          (file) =>
            file.startsWith("contributors-") &&
            !file.includes("summary") &&
            file.endsWith(".json")
        )
        .sort()
        .reverse();

      let dataFile;
      if (fullFiles.length > 0) {
        dataFile = fullFiles[0];
      } else {
        // Fallback to summary file if full file not found
        const summaryFiles = fs
          .readdirSync(process.cwd())
          .filter(
            (file) =>
              file.startsWith("contributors-summary-") && file.endsWith(".json")
          )
          .sort()
          .reverse();

        if (summaryFiles.length === 0) {
          throw new Error(
            "No contributor data files found. Run fetch-contributors.js first."
          );
        }
        dataFile = summaryFiles[0];
      }

      console.log(`Loading data from: ${dataFile}`);

      const rawData = fs.readFileSync(dataFile, "utf8");
      this.data = JSON.parse(rawData);

      return true;
    } catch (error) {
      console.error("Error loading data:", error.message);
      return false;
    }
  }

  /**
   * Generate insights and analysis
   */
  generateInsights() {
    if (!this.data) return null;

    const stats = this.data.statistics;
    const contributors = this.data.contributors || [];

    // Calculate total lines added and deleted across all contributors
    let totalAdditions = 0;
    let totalDeletions = 0;
    contributors.forEach((contributor) => {
      contributor.weeks.forEach((week) => {
        totalAdditions += week.additions || 0;
        totalDeletions += week.deletions || 0;
      });
    });

    const insights = {
      // Basic stats
      totalContributors: stats.total_contributors,
      totalCommits: stats.total_commits,
      mostActiveContributor: stats.most_active_contributor,

      // Lines analysis
      totalAdditions: totalAdditions,
      totalDeletions: totalDeletions,
      netLines: totalAdditions - totalDeletions,

      // Activity analysis
      avgCommitsPerContributor: Math.round(
        stats.total_commits / stats.total_contributors
      ),
      commitDistribution: stats.commit_distribution,

      // Time-based analysis
      weeklyActivity: stats.weekly_activity,
      mostActiveWeek: this.findMostActiveWeek(stats.weekly_activity),
      leastActiveWeek: this.findLeastActiveWeek(stats.weekly_activity),

      // Contributor analysis
      topContributors: this.getTopContributors(contributors, 5),
      newContributors: this.findNewContributors(contributors),

      // Trends
      recentActivity: this.analyzeRecentActivity(stats.weekly_activity),
      activityTrend: this.calculateActivityTrend(stats.weekly_activity),
    };

    return insights;
  }

  /**
   * Find the most active week
   */
  findMostActiveWeek(weeklyActivity) {
    let maxCommits = 0;
    let mostActiveWeek = null;

    Object.entries(weeklyActivity).forEach(([week, data]) => {
      if (data.commits > maxCommits) {
        maxCommits = data.commits;
        mostActiveWeek = {
          week,
          commits: data.commits,
          contributors: data.contributors,
        };
      }
    });

    return mostActiveWeek;
  }

  /**
   * Find the least active week (excluding weeks with 0 commits)
   */
  findLeastActiveWeek(weeklyActivity) {
    let minCommits = Infinity;
    let leastActiveWeek = null;

    Object.entries(weeklyActivity).forEach(([week, data]) => {
      if (data.commits > 0 && data.commits < minCommits) {
        minCommits = data.commits;
        leastActiveWeek = {
          week,
          commits: data.commits,
          contributors: data.contributors,
        };
      }
    });

    return leastActiveWeek;
  }

  /**
   * Get top contributors by commit count
   */
  getTopContributors(contributors, limit = 5) {
    return contributors
      .sort((a, b) => b.total_commits - a.total_commits)
      .slice(0, limit)
      .map((contributor) => {
        // Calculate total lines added and deleted
        let totalAdditions = 0;
        let totalDeletions = 0;

        contributor.weeks.forEach((week) => {
          totalAdditions += week.additions || 0;
          totalDeletions += week.deletions || 0;
        });

        return {
          name: contributor.author.login,
          commits: contributor.total_commits,
          additions: totalAdditions,
          deletions: totalDeletions,
          netLines: totalAdditions - totalDeletions,
          avatar: contributor.author.avatar_url,
          profile: contributor.author.html_url,
        };
      });
  }

  /**
   * Find contributors who joined recently (last 4 weeks)
   */
  findNewContributors(contributors) {
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    return contributors
      .filter((contributor) => {
        const firstCommit = contributor.weeks.find((week) => week.commits > 0);
        if (!firstCommit) return false;

        const firstCommitDate = new Date(firstCommit.week_start);
        return firstCommitDate >= fourWeeksAgo;
      })
      .map((contributor) => ({
        name: contributor.author.login,
        commits: contributor.total_commits,
        firstCommit: contributor.weeks.find((week) => week.commits > 0)
          ?.week_start,
      }));
  }

  /**
   * Analyze recent activity (last 4 weeks)
   */
  analyzeRecentActivity(weeklyActivity) {
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const recentWeeks = Object.entries(weeklyActivity)
      .filter(([week]) => new Date(week) >= fourWeeksAgo)
      .sort(([a], [b]) => new Date(a) - new Date(b));

    const totalRecentCommits = recentWeeks.reduce(
      (sum, [, data]) => sum + data.commits,
      0
    );
    const avgRecentCommits =
      recentWeeks.length > 0 ? totalRecentCommits / recentWeeks.length : 0;

    // Calculate lines data for recent weeks
    const contributors = this.data.contributors || [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    contributors.forEach((contributor) => {
      contributor.weeks.forEach((week) => {
        const weekDate = new Date(week.week_start);
        if (weekDate >= fourWeeksAgo) {
          totalAdditions += week.additions || 0;
          totalDeletions += week.deletions || 0;
        }
      });
    });

    return {
      weeks: recentWeeks.length,
      totalCommits: totalRecentCommits,
      avgCommitsPerWeek: Math.round(avgRecentCommits * 10) / 10,
      weeksWithActivity: recentWeeks.filter(([, data]) => data.commits > 0)
        .length,
      totalAdditions: totalAdditions,
      totalDeletions: totalDeletions,
      netLines: totalAdditions - totalDeletions,
    };
  }

  /**
   * Get commits for last 8 weeks
   */
  getLast8WeeksCommits(weeklyActivity) {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    return Object.entries(weeklyActivity)
      .filter(([week]) => new Date(week) >= eightWeeksAgo)
      .reduce((sum, [, data]) => sum + data.commits, 0);
  }

  /**
   * Get active contributors for last 8 weeks
   */
  getLast8WeeksContributors(weeklyActivity) {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const recentWeeks = Object.entries(weeklyActivity)
      .filter(([week]) => new Date(week) >= eightWeeksAgo)
      .filter(([, data]) => data.commits > 0);

    return recentWeeks.length;
  }

  /**
   * Get average commits per week for last 8 weeks
   */
  getLast8WeeksAvg(weeklyActivity) {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const recentWeeks = Object.entries(weeklyActivity).filter(
      ([week]) => new Date(week) >= eightWeeksAgo
    );

    const totalCommits = recentWeeks.reduce(
      (sum, [, data]) => sum + data.commits,
      0
    );
    return recentWeeks.length > 0
      ? Math.round((totalCommits / recentWeeks.length) * 10) / 10
      : 0;
  }

  /**
   * Get total weeks with activity
   */
  getTotalWeeks(weeklyActivity) {
    const weeksWithActivity = Object.entries(weeklyActivity).filter(
      ([, data]) => data.commits > 0
    ).length;
    return weeksWithActivity > 0 ? weeksWithActivity : 1; // Avoid division by zero
  }

  /**
   * Calculate activity trend (comparing last 4 weeks vs previous 4 weeks)
   */
  calculateActivityTrend(weeklyActivity) {
    const now = new Date();
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);

    const recentWeeks = Object.entries(weeklyActivity).filter(([week]) => {
      const weekDate = new Date(week);
      return weekDate >= fourWeeksAgo && weekDate < now;
    });

    const previousWeeks = Object.entries(weeklyActivity).filter(([week]) => {
      const weekDate = new Date(week);
      return weekDate >= eightWeeksAgo && weekDate < fourWeeksAgo;
    });

    const recentCommits = recentWeeks.reduce(
      (sum, [, data]) => sum + data.commits,
      0
    );
    const previousCommits = previousWeeks.reduce(
      (sum, [, data]) => sum + data.commits,
      0
    );

    if (previousCommits === 0) {
      return recentCommits > 0 ? "increasing" : "stable";
    }

    const changePercent =
      ((recentCommits - previousCommits) / previousCommits) * 100;

    if (changePercent > 20) return "increasing";
    if (changePercent < -20) return "decreasing";
    return "stable";
  }

  /**
   * Generate markdown content
   */
  generateMarkdown(insights) {
    const { repository, fetched_at } = this.data;
    const trendEmoji = {
      increasing: "📈",
      decreasing: "📉",
      stable: "📊",
    };

    return `# 📊 Estatísticas dos Contribuidores

> **Repositório:** ${repository}  
> **Última Atualização:** ${new Date(fetched_at).toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}  
> **Gerado por:** [GitHub Action](.github/workflows/contributor-stats.yml)

---

## 🎯 Visão Geral

| Métrica | Valor |
|---------|-------|
| **Total de Contribuidores** | ${insights.totalContributors} |
| **Total de Commits** | ${insights.totalCommits.toLocaleString()} |
| **Total de Linhas Adicionadas** | +${insights.totalAdditions.toLocaleString()} |
| **Total de Linhas Removidas** | -${insights.totalDeletions.toLocaleString()} |
| **Saldo de Linhas Alteradas** | ${
      insights.netLines >= 0 ? "+" : ""
    }${insights.netLines.toLocaleString()} |
| **Média de Commits por Contribuidor** | ${insights.avgCommitsPerContributor} |
| **Contribuidor Mais Ativo** | [@${
      insights.mostActiveContributor
    }](https://github.com/${insights.mostActiveContributor}) |
| **Tendência de Atividade** | ${trendEmoji[insights.activityTrend]} ${
      insights.activityTrend === 'increasing' ? 'crescendo' : 
      insights.activityTrend === 'decreasing' ? 'diminuindo' : 'estável'
    } |

---

## 🏆 Top Contribuidores

${insights.topContributors
  .map((contributor, index) => {
    const medal = ["🥇", "🥈", "🥉"][index] || "🏅";
    const netLinesDisplay =
      contributor.netLines >= 0
        ? `+${contributor.netLines.toLocaleString()}`
        : contributor.netLines.toLocaleString();
    return `${medal} **${index + 1}.** [@${
      contributor.name
    }](https://github.com/${contributor.name}) - ${
      contributor.commits
    } commits (${contributor.additions.toLocaleString()}+ / ${contributor.deletions.toLocaleString()}- / ${netLinesDisplay} líquido)`;
  })
  .join("\n")}

---

## 📈 Análise de Atividade

### Destaques da Atividade Semanal
- **Semana Mais Ativa:** ${
      insights.mostActiveWeek
        ? `${insights.mostActiveWeek.week} (${insights.mostActiveWeek.commits} commits por ${insights.mostActiveWeek.contributors} contribuidores)`
        : "N/A"
    }
- **Semana Menos Ativa:** ${
      insights.leastActiveWeek
        ? `${insights.leastActiveWeek.week} (${insights.leastActiveWeek.commits} commits por ${insights.leastActiveWeek.contributors} contribuidores)`
        : "N/A"
    }

### Atividade Recente (Últimas 4 Semanas)
- **Total de Commits:** ${insights.recentActivity.totalCommits}
- **Média por Semana:** ${insights.recentActivity.avgCommitsPerWeek}
- **Semanas com Atividade:** ${insights.recentActivity.weeksWithActivity}/${
      insights.recentActivity.weeks
    }
- **Linhas Adicionadas:** +${insights.recentActivity.totalAdditions.toLocaleString()}
- **Linhas Removidas:** -${insights.recentActivity.totalDeletions.toLocaleString()}
- **Saldo de Linhas:** ${
      insights.recentActivity.netLines >= 0 ? "+" : ""
    }${insights.recentActivity.netLines.toLocaleString()}

---

## 🆕 Contribuidores Recentes

${
  insights.newContributors.length > 0
    ? insights.newContributors
        .map(
          (contributor) =>
            `- [@${contributor.name}](https://github.com/${contributor.name}) - ${contributor.commits} commits (primeiro commit: ${contributor.firstCommit})`
        )
        .join("\n")
    : "Nenhum novo contribuidor nas últimas 4 semanas"
}

---

## 📊 Distribuição de Commits

| Faixa | Contribuidores | Porcentagem |
|-------|----------------|-------------|
${Object.entries(insights.commitDistribution)
  .map(([range, count]) => {
    const percentage = Math.round((count / insights.totalContributors) * 100);
    return `| ${range} commits | ${count} | ${percentage}% |`;
  })
  .join("\n")}

---

## 📅 Resumo da Atividade Recente

| Período | Commits | Contribuidores | Nível de Atividade |
|---------|---------|----------------|-------------------|
| **Últimas 4 semanas** | ${insights.recentActivity.totalCommits} | ${
      insights.recentActivity.weeksWithActivity
    } ativos | ${insights.recentActivity.avgCommitsPerWeek} média/semana |
| **Últimas 8 semanas** | ${this.getLast8WeeksCommits(
      insights.weeklyActivity
    )} | ${this.getLast8WeeksContributors(
      insights.weeklyActivity
    )} ativos | ${this.getLast8WeeksAvg(insights.weeklyActivity)} média/semana |
| **Histórico completo** | ${insights.totalCommits} | ${
      insights.totalContributors
    } | ${Math.round(
      insights.totalCommits / this.getTotalWeeks(insights.weeklyActivity)
    )} média/semana |

---

## 🔄 Automação

Este relatório é gerado automaticamente todo **domingo às 2h UTC** por uma GitHub Action. Você também pode executá-lo manualmente na aba Actions.

**Última execução:** ${new Date().toISOString()}

---

*Gerado com ❤️ por [GitHub Actions](https://github.com/features/actions)*
`;
  }

  /**
   * Save markdown to file
   */
  saveMarkdown(content) {
    fs.writeFileSync(this.outputFile, content);
    console.log(`✅ Insights saved to: ${this.outputFile}`);
  }

  /**
   * Main execution method
   */
  run() {
    console.log("🔍 Loading contributor data...");

    if (!this.loadData()) {
      console.error("❌ Failed to load data");
      process.exit(1);
    }

    console.log("📊 Generating insights...");
    const insights = this.generateInsights();

    if (!insights) {
      console.error("❌ Failed to generate insights");
      process.exit(1);
    }

    console.log("📝 Creating markdown report...");
    const markdown = this.generateMarkdown(insights);

    this.saveMarkdown(markdown);

    console.log("✅ Contributor insights generated successfully!");
    console.log(`📄 Report saved to: ${this.outputFile}`);
  }
}

// CLI execution
if (require.main === module) {
  const generator = new ContributorInsightsGenerator();
  generator.run();
}

module.exports = ContributorInsightsGenerator;
