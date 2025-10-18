#!/usr/bin/env python3

"""
Contributor Visualization Generator

This script generates beautiful charts and images from contributor data
fetched by fetch-contributors.js. It creates two main visualizations:
1. Top 3 Contributors Bar Chart
2. Complete Ranking Chart with all contributors
"""

import json
import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch
import seaborn as sns
import numpy as np
from datetime import datetime
import warnings

# Suppress matplotlib warnings
warnings.filterwarnings('ignore')

class ContributorVisualizer:
    def __init__(self):
        self.data = None
        self.output_dir = "images"
        self.colors = {
            'primary': '#2E86AB',      # Blue
            'secondary': '#A23B72',   # Purple
            'accent': '#F18F01',      # Orange
            'success': '#C73E1D',     # Red
            'background': '#F8F9FA',  # Light gray
            'text': '#2C3E50',        # Dark gray
            'grid': '#E9ECEF'         # Light grid
        }
        
        # Set up matplotlib style
        plt.style.use('default')
        sns.set_palette([self.colors['primary'], self.colors['secondary'], 
                       self.colors['accent'], self.colors['success']])
        
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)

    def load_data(self):
        """Load contributor data from JSON file"""
        try:
            # First try to find the full contributors file (not summary)
            full_files = [f for f in os.listdir('.') if f.startswith('contributors-') and not f.startswith('contributors-summary-') and f.endswith('.json')]
            
            if full_files:
                # Sort by modification time and get the most recent full file
                full_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
                data_file = full_files[0]
            else:
                # Fallback to summary file if full file not found
                summary_files = [f for f in os.listdir('.') if f.startswith('contributors-summary-') and f.endswith('.json')]
                if not summary_files:
                    print("❌ No contributor data files found")
                    return False
                summary_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
                data_file = summary_files[0]
            
            print(f"📊 Loading data from: {data_file}")
            
            with open(data_file, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            
            return True
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            return False

    def prepare_contributor_data(self):
        """Prepare and sort contributor data"""
        contributors = self.data.get('contributors', [])
        
        print(f"📊 Found {len(contributors)} contributors in data")
        
        if not contributors:
            print("❌ No contributors found in data")
            print(f"Available keys in data: {list(self.data.keys())}")
            return []
        
        # Calculate additional metrics for each contributor
        processed_contributors = []
        for contributor in contributors:
            # Handle both full and summary data formats
            if 'weeks' in contributor:
                # Full data format
                total_additions = sum(week.get('additions', 0) for week in contributor.get('weeks', []))
                total_deletions = sum(week.get('deletions', 0) for week in contributor.get('weeks', []))
            else:
                # Summary data format - use statistics if available
                total_additions = contributor.get('total_additions', 0)
                total_deletions = contributor.get('total_deletions', 0)
            
            processed_contributors.append({
                'name': contributor['author']['login'],
                'commits': contributor['total_commits'],
                'additions': total_additions,
                'deletions': total_deletions,
                'net_lines': total_additions - total_deletions,
                'avatar_url': contributor['author']['avatar_url']
            })
        
        # Sort by commits (descending)
        processed_contributors.sort(key=lambda x: x['commits'], reverse=True)
        print(f"✅ Processed {len(processed_contributors)} contributors")
        return processed_contributors

    def create_top3_chart(self, contributors):
        """Create a beautiful bar chart for top 3 contributors"""
        top3 = contributors[:3]
        
        # Create figure with custom styling
        fig, ax = plt.subplots(figsize=(12, 8))
        fig.patch.set_facecolor(self.colors['background'])
        ax.set_facecolor(self.colors['background'])
        
        # Prepare data
        names = [contrib['name'] for contrib in top3]
        commits = [contrib['commits'] for contrib in top3]
        
        # Create bars with gradient effect
        bars = ax.bar(range(len(names)), commits, 
                     color=[self.colors['primary'], self.colors['secondary'], self.colors['accent']],
                     edgecolor='white', linewidth=2, alpha=0.8)
        
        # Add value labels on top of bars
        for i, (bar, commit_count) in enumerate(zip(bars, commits)):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + max(commits)*0.01,
                   f'{commit_count}', ha='center', va='bottom', 
                   fontsize=14, fontweight='bold', color=self.colors['text'])
        
        # Customize the chart
        ax.set_xlabel('Contribuidores', fontsize=14, fontweight='bold', color=self.colors['text'])
        ax.set_ylabel('Número de Commits', fontsize=14, fontweight='bold', color=self.colors['text'])
        ax.set_title('🏆 Top 3 Contribuidores - Projeto Aquário', 
                    fontsize=18, fontweight='bold', color=self.colors['text'], pad=20)
        
        # Set x-axis labels
        ax.set_xticks(range(len(names)))
        ax.set_xticklabels([f'@{name}' for name in names], fontsize=12, color=self.colors['text'])
        
        # Add medals
        medals = ['🥇', '🥈', '🥉']
        for i, medal in enumerate(medals):
            ax.text(i, max(commits)*0.7, medal, ha='center', va='center', 
                   fontsize=24, alpha=0.8)
        
        # Style the chart
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color(self.colors['grid'])
        ax.spines['bottom'].set_color(self.colors['grid'])
        ax.grid(True, alpha=0.3, color=self.colors['grid'])
        ax.set_axisbelow(True)
        
        # Add repository info
        repo_name = self.data.get('repository', 'ralfferreira/aquario')
        ax.text(0.02, 0.98, f'Repositório: {repo_name}', transform=ax.transAxes,
               fontsize=10, color=self.colors['text'], alpha=0.7,
               verticalalignment='top', bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
        
        # Add generation timestamp
        timestamp = datetime.now().strftime('%d/%m/%Y %H:%M')
        ax.text(0.98, 0.02, f'Gerado em: {timestamp}', transform=ax.transAxes,
               fontsize=10, color=self.colors['text'], alpha=0.7,
               horizontalalignment='right', verticalalignment='bottom',
               bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
        
        plt.tight_layout()
        
        # Save the chart
        output_path = os.path.join(self.output_dir, 'top3-contributors.png')
        plt.savefig(output_path, dpi=300, bbox_inches='tight', 
                   facecolor=self.colors['background'], edgecolor='none')
        plt.close()
        
        print(f"✅ Top 3 chart saved to: {output_path}")
        return output_path

    def create_complete_ranking_chart(self, contributors):
        """Create a comprehensive ranking chart with all contributors"""
        # Limit to top 10 for readability
        top_contributors = contributors[:10]
        
        # Create figure
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 12))
        fig.patch.set_facecolor(self.colors['background'])
        
        # Chart 1: Commits ranking
        names = [contrib['name'] for contrib in top_contributors]
        commits = [contrib['commits'] for contrib in top_contributors]
        
        # Create horizontal bar chart for commits
        y_pos = np.arange(len(names))
        bars1 = ax1.barh(y_pos, commits, color=self.colors['primary'], alpha=0.8, edgecolor='white')
        
        # Add value labels
        for i, (bar, commit_count) in enumerate(zip(bars1, commits)):
            width = bar.get_width()
            ax1.text(width + max(commits)*0.01, bar.get_y() + bar.get_height()/2,
                    f'{commit_count}', ha='left', va='center', fontweight='bold')
        
        ax1.set_yticks(y_pos)
        ax1.set_yticklabels([f'@{name}' for name in names])
        ax1.set_xlabel('Número de Commits', fontweight='bold', color=self.colors['text'])
        ax1.set_title('📊 Ranking Completo - Commits por Contribuidor', 
                     fontsize=16, fontweight='bold', color=self.colors['text'])
        ax1.grid(True, alpha=0.3, axis='x')
        ax1.spines['top'].set_visible(False)
        ax1.spines['right'].set_visible(False)
        
        # Chart 2: Lines added vs deleted
        additions = [contrib['additions'] for contrib in top_contributors]
        deletions = [contrib['deletions'] for contrib in top_contributors]
        
        x = np.arange(len(names))
        width = 0.35
        
        bars2_add = ax2.bar(x - width/2, additions, width, label='Linhas Adicionadas', 
                           color=self.colors['success'], alpha=0.8)
        bars2_del = ax2.bar(x + width/2, deletions, width, label='Linhas Removidas', 
                           color=self.colors['accent'], alpha=0.8)
        
        ax2.set_xlabel('Contribuidores', fontweight='bold', color=self.colors['text'])
        ax2.set_ylabel('Número de Linhas', fontweight='bold', color=self.colors['text'])
        ax2.set_title('📈 Linhas Adicionadas vs Removidas', 
                     fontsize=16, fontweight='bold', color=self.colors['text'])
        ax2.set_xticks(x)
        ax2.set_xticklabels([f'@{name}' for name in names], rotation=45, ha='right')
        ax2.legend()
        ax2.grid(True, alpha=0.3, axis='y')
        ax2.spines['top'].set_visible(False)
        ax2.spines['right'].set_visible(False)
        
        # Add repository info
        repo_name = self.data.get('repository', 'ralfferreira/aquario')
        fig.text(0.02, 0.98, f'Repositório: {repo_name}', fontsize=10, 
                color=self.colors['text'], alpha=0.7, verticalalignment='top',
                bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
        
        # Add generation timestamp
        timestamp = datetime.now().strftime('%d/%m/%Y %H:%M')
        fig.text(0.98, 0.02, f'Gerado em: {timestamp}', fontsize=10, 
                color=self.colors['text'], alpha=0.7, horizontalalignment='right',
                bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
        
        plt.tight_layout()
        
        # Save the chart
        output_path = os.path.join(self.output_dir, 'complete-ranking.png')
        plt.savefig(output_path, dpi=300, bbox_inches='tight', 
                   facecolor=self.colors['background'], edgecolor='none')
        plt.close()
        
        print(f"✅ Complete ranking chart saved to: {output_path}")
        return output_path

    def generate_all_charts(self):
        """Generate all visualization charts"""
        if not self.load_data():
            return False
        
        contributors = self.prepare_contributor_data()
        
        if not contributors:
            print("❌ No contributor data to visualize")
            return False
        
        print(f"📊 Processing {len(contributors)} contributors...")
        
        # Generate charts
        top3_path = self.create_top3_chart(contributors)
        complete_path = self.create_complete_ranking_chart(contributors)
        
        print("✅ All charts generated successfully!")
        return True

def main():
    """Main execution function"""
    print("🎨 Starting Contributor Visualization Generator...")
    
    visualizer = ContributorVisualizer()
    success = visualizer.generate_all_charts()
    
    if success:
        print("🎉 Visualization generation completed successfully!")
    else:
        print("❌ Visualization generation failed!")
        exit(1)

if __name__ == "__main__":
    main()
