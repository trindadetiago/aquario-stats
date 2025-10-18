#!/usr/bin/env node

/**
 * GitHub Contributors Data Fetcher
 * 
 * This script fetches contributor data from GitHub's contributors endpoint
 * and processes it to extract commit information, author details, and statistics.
 * 
 * Usage:
 *   node fetch-contributors.js [owner] [repo] [--token YOUR_TOKEN]
 * 
 * Example:
 *   node fetch-contributors.js trindadetiago aquario
 *   node fetch-contributors.js trindadetiago aquario --token ghp_xxxxxxxxxxxx
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class GitHubContributorsFetcher {
  constructor(owner, repo, token = null) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.baseUrl = 'https://github.com';
  }

  /**
   * Fetch contributors data from GitHub
   */
  async fetchContributorsData() {
    const url = `${this.baseUrl}/${this.owner}/${this.repo}/graphs/contributors-data`;
    
    const options = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GitHub-Contributors-Fetcher/1.0',
        'X-Requested-With': 'XMLHttpRequest'
      }
    };

    // Add authentication if token is provided
    if (this.token) {
      options.headers['Authorization'] = `token ${this.token}`;
    }

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse JSON response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * Process contributors data and extract useful information
   */
  processContributorsData(rawData) {
    const contributors = [];
    
    if (rawData && Array.isArray(rawData)) {
      rawData.forEach(contributor => {
        const processedContributor = {
          author: {
            login: contributor.author?.login || 'Unknown',
            id: contributor.author?.id || null,
            avatar_url: contributor.author?.avatar_url || null,
            html_url: contributor.author?.html_url || null,
            type: contributor.author?.type || 'User'
          },
          total_commits: contributor.total || 0,
          weeks: []
        };

        // Process weekly commit data
        if (contributor.weeks && Array.isArray(contributor.weeks)) {
          contributor.weeks.forEach(week => {
            processedContributor.weeks.push({
              week_start: new Date(week.w * 1000).toISOString().split('T')[0],
              commits: week.c || 0,
              additions: week.a || 0,
              deletions: week.d || 0
            });
          });
        }

        contributors.push(processedContributor);
      });
    }

    return contributors;
  }

  /**
   * Generate statistics from contributors data
   */
  generateStatistics(contributors) {
    const stats = {
      total_contributors: contributors.length,
      total_commits: contributors.reduce((sum, c) => sum + c.total_commits, 0),
      most_active_contributor: null,
      commit_distribution: {},
      weekly_activity: {}
    };

    let maxCommits = 0;
    contributors.forEach(contributor => {
      // Find most active contributor
      if (contributor.total_commits > maxCommits) {
        maxCommits = contributor.total_commits;
        stats.most_active_contributor = contributor.author.login;
      }

      // Commit distribution
      const range = this.getCommitRange(contributor.total_commits);
      stats.commit_distribution[range] = (stats.commit_distribution[range] || 0) + 1;

      // Weekly activity analysis
      contributor.weeks.forEach(week => {
        if (!stats.weekly_activity[week.week_start]) {
          stats.weekly_activity[week.week_start] = {
            commits: 0,
            contributors: new Set()
          };
        }
        stats.weekly_activity[week.week_start].commits += week.commits;
        stats.weekly_activity[week.week_start].contributors.add(contributor.author.login);
      });
    });

    // Convert Set to count for weekly activity
    Object.keys(stats.weekly_activity).forEach(week => {
      stats.weekly_activity[week].contributors = stats.weekly_activity[week].contributors.size;
    });

    return stats;
  }

  /**
   * Categorize commit count into ranges
   */
  getCommitRange(commits) {
    if (commits === 0) return '0';
    if (commits <= 5) return '1-5';
    if (commits <= 20) return '6-20';
    if (commits <= 50) return '21-50';
    if (commits <= 100) return '51-100';
    return '100+';
  }

  /**
   * Save data to JSON file
   */
  async saveToFile(data, filename) {
    const outputPath = path.join(process.cwd(), filename);
    await fs.promises.writeFile(outputPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to: ${outputPath}`);
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      console.log(`Fetching contributors data for ${this.owner}/${this.repo}...`);
      
      const rawData = await this.fetchContributorsData();
      console.log('✓ Data fetched successfully');
      
      const contributors = this.processContributorsData(rawData);
      console.log(`✓ Processed ${contributors.length} contributors`);
      
      const statistics = this.generateStatistics(contributors);
      console.log('✓ Generated statistics');
      
      const output = {
        repository: `${this.owner}/${this.repo}`,
        fetched_at: new Date().toISOString(),
        statistics,
        contributors
      };

      // Save detailed data
      await this.saveToFile(output, `contributors-${this.owner}-${this.repo}.json`);
      
      // Save summary
      const summary = {
        repository: `${this.owner}/${this.repo}`,
        fetched_at: new Date().toISOString(),
        statistics
      };
      await this.saveToFile(summary, `contributors-summary-${this.owner}-${this.repo}.json`);

      // Print summary to console
      console.log('\n📊 SUMMARY:');
      console.log(`Total Contributors: ${statistics.total_contributors}`);
      console.log(`Total Commits: ${statistics.total_commits}`);
      console.log(`Most Active: ${statistics.most_active_contributor}`);
      console.log('\nCommit Distribution:');
      Object.entries(statistics.commit_distribution).forEach(([range, count]) => {
        console.log(`  ${range} commits: ${count} contributors`);
      });

      return output;
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node fetch-contributors.js <owner> <repo> [--token YOUR_TOKEN]');
    console.log('Example: node fetch-contributors.js trindadetiago aquario');
    process.exit(1);
  }

  const owner = args[0];
  const repo = args[1];
  const tokenIndex = args.indexOf('--token');
  const token = tokenIndex !== -1 && args[tokenIndex + 1] ? args[tokenIndex + 1] : null;

  const fetcher = new GitHubContributorsFetcher(owner, repo, token);
  
  fetcher.run()
    .then(() => {
      console.log('\n✅ Done!');
    })
    .catch((error) => {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    });
}

module.exports = GitHubContributorsFetcher;