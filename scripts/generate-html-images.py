#!/usr/bin/env python3

"""
HTML to Image Generator for GitHub-Style Stats Widgets

This script generates beautiful GitHub-style stats images by:
1. Loading contributor data
2. Creating HTML templates with GitHub styling
3. Rendering HTML to PNG using Puppeteer
4. Saving high-quality images
"""

import json
import os
import asyncio
from datetime import datetime
from pyppeteer import launch
from pathlib import Path

class HTMLStatsGenerator:
    def __init__(self):
        self.data = None
        self.templates_dir = Path("templates")
        self.output_dir = Path("images")
        self.output_dir.mkdir(exist_ok=True)

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
        """Prepare contributor data for HTML templates"""
        contributors = self.data.get('contributors', [])
        stats = self.data.get('statistics', {})
        
        # Calculate totals
        total_additions = sum(
            sum(week.get('additions', 0) for week in contributor.get('weeks', []))
            for contributor in contributors
        )
        total_deletions = sum(
            sum(week.get('deletions', 0) for week in contributor.get('weeks', []))
            for contributor in contributors
        )
        
        # Prepare contributors data
        contributors_data = []
        for contributor in contributors:
            # Handle both full and summary data formats
            if 'weeks' in contributor:
                # Full data format
                additions = sum(week.get('additions', 0) for week in contributor.get('weeks', []))
                deletions = sum(week.get('deletions', 0) for week in contributor.get('weeks', []))
            else:
                # Summary data format
                additions = contributor.get('total_additions', 0)
                deletions = contributor.get('total_deletions', 0)
            
            contributors_data.append({
                'name': contributor['author']['login'],
                'commits': contributor['total_commits'],
                'additions': additions,
                'deletions': deletions,
                'net_lines': additions - deletions,
                'avatar_url': contributor['author'].get('avatar_url'),
                'profile_url': contributor['author'].get('html_url')
            })
        
        # Sort by commits (descending)
        contributors_data.sort(key=lambda x: x['commits'], reverse=True)
        
        return {
            'repository': self.data.get('repository', 'aquario-ufpb/aquario'),
            'total_contributors': len(contributors),
            'total_commits': stats.get('total_commits', sum(c['commits'] for c in contributors_data)),
            'total_additions': total_additions,
            'total_deletions': total_deletions,
            'net_lines': total_additions - total_deletions,
            'contributors': contributors_data,
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M UTC')
        }

    def create_overview_html(self, data):
        """Create overview stats HTML"""
        template_path = self.templates_dir / "overview-stats.html"
        
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Replace placeholders
        html_content = html_content.replace('{{REPOSITORY}}', data['repository'])
        html_content = html_content.replace('{{TOTAL_CONTRIBUTORS}}', str(data['total_contributors']))
        html_content = html_content.replace('{{TOTAL_COMMITS}}', f"{data['total_commits']:,}")
        html_content = html_content.replace('{{TOTAL_ADDITIONS}}', f"{data['total_additions']:,}")
        html_content = html_content.replace('{{TOTAL_DELETIONS}}', f"{data['total_deletions']:,}")
        html_content = html_content.replace('{{LAST_UPDATED}}', data['last_updated'])
        
        # Create contributors list
        medals = ['🥇', '🥈', '🥉', '🏅', '🏅']
        contributors_html = ""
        
        for i, contributor in enumerate(data['contributors'][:3]):  # Top 3
            medal = medals[i] if i < len(medals) else '🏅'
            contributors_html += f'''
                <div class="contributor-item">
                    <span class="contributor-rank">{medal}</span>
                    <span class="contributor-name">@{contributor['name']}</span>
                    <span class="contributor-stats">{contributor['commits']} commits</span>
                </div>
            '''
        
        html_content = html_content.replace('{{CONTRIBUTORS_LIST}}', contributors_html)
        
        return html_content

    def create_detailed_html(self, data):
        """Create detailed ranking HTML"""
        template_path = self.templates_dir / "detailed-ranking.html"
        
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Replace placeholders
        html_content = html_content.replace('{{REPOSITORY}}', data['repository'])
        html_content = html_content.replace('{{TOTAL_CONTRIBUTORS}}', str(data['total_contributors']))
        html_content = html_content.replace('{{TOTAL_COMMITS}}', f"{data['total_commits']:,}")
        html_content = html_content.replace('{{TOTAL_ADDITIONS}}', f"{data['total_additions']:,}")
        html_content = html_content.replace('{{TOTAL_DELETIONS}}', f"{data['total_deletions']:,}")
        html_content = html_content.replace('{{NET_LINES}}', f"{data['net_lines']:,}")
        html_content = html_content.replace('{{LAST_UPDATED}}', data['last_updated'])
        
        # Create ranking table rows
        medals = ['🥇', '🥈', '🥉', '🏅', '🏅']
        table_rows = ""
        
        for i, contributor in enumerate(data['contributors']):
            medal = medals[i] if i < len(medals) else '🏅'
            net_lines_display = f"+{contributor['net_lines']:,}" if contributor['net_lines'] >= 0 else f"{contributor['net_lines']:,}"
            
            table_rows += f'''
                <tr>
                    <td class="rank-cell">
                        <span class="medal">{medal}</span>
                        {i + 1}
                    </td>
                    <td class="contributor-name">@{contributor['name']}</td>
                    <td class="commits-cell">{contributor['commits']}</td>
                    <td class="lines-added">+{contributor['additions']:,}</td>
                    <td class="lines-deleted">-{contributor['deletions']:,}</td>
                    <td class="lines-net">{net_lines_display}</td>
                </tr>
            '''
        
        html_content = html_content.replace('{{RANKING_TABLE_ROWS}}', table_rows)
        
        return html_content

    async def render_html_to_image(self, html_content, output_path, width=800, height=600):
        """Render HTML content to PNG image using Puppeteer"""
        browser = None
        try:
            # Launch browser with more stable options
            browser = await launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ],
                handleSIGINT=False,
                handleSIGTERM=False,
                handleSIGHUP=False
            )
            
            page = await browser.newPage()
            
            # Set viewport size to match content
            await page.setViewport({
                'width': width,
                'height': height,
                'deviceScaleFactor': 2  # High DPI for crisp images
            })
            
            # Set page size to match content
            await page.evaluate(f'''
                document.body.style.margin = '0';
                document.body.style.padding = '0';
                document.documentElement.style.width = '{width}px';
                document.documentElement.style.height = '{height}px';
            ''')
            
            # Set content
            await page.setContent(html_content)
            
            # Wait a bit for any dynamic content
            await asyncio.sleep(2)
            
            # Take screenshot with exact viewport dimensions
            await page.screenshot({
                'path': str(output_path),
                'type': 'png',
                'clip': {
                    'x': 0,
                    'y': 0,
                    'width': width,
                    'height': height
                }
            })
            
            return True
            
        except Exception as e:
            print(f"❌ Error rendering HTML to image: {e}")
            return False
        finally:
            if browser:
                try:
                    await browser.close()
                except:
                    pass

    async def generate_images(self):
        """Generate both overview and detailed ranking images"""
        if not self.load_data():
            return False
        
        data = self.prepare_contributor_data()
        print(f"📊 Processing {data['total_contributors']} contributors...")
        
        # Generate overview image
        print("🎨 Generating overview stats image...")
        overview_html = self.create_overview_html(data)
        overview_success = await self.render_html_to_image(
            overview_html,
            self.output_dir / "top3-contributors.png",
            width=600,
            height=655
        )
        
        if overview_success:
            print(f"✅ Overview image saved to: {self.output_dir / 'top3-contributors.png'}")
        else:
            print("❌ Failed to generate overview image")
            return False
        
        # Generate detailed ranking image
        print("🎨 Generating detailed ranking image...")
        detailed_html = self.create_detailed_html(data)
        height_complete_ranking = 360
        height_complete_ranking = height_complete_ranking + (len(data['contributors']) * 45)
        detailed_success = await self.render_html_to_image(
            detailed_html,
            self.output_dir / "complete-ranking.png",
            width=800,
            height=height_complete_ranking
        )
        
        if detailed_success:
            print(f"✅ Detailed ranking image saved to: {self.output_dir / 'complete-ranking.png'}")
        else:
            print("❌ Failed to generate detailed ranking image")
            return False
        
        return True

async def main():
    """Main execution function"""
    print("🎨 Starting HTML-to-Image Stats Generator...")
    
    generator = HTMLStatsGenerator()
    success = await generator.generate_images()
    
    if success:
        print("🎉 HTML-to-image generation completed successfully!")
    else:
        print("❌ HTML-to-image generation failed!")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())
