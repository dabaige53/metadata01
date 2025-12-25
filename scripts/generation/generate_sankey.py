
import sqlite3
import json
import os

# Configuration
DB_PATH = 'metadata.db'
OUTPUT_FILE = 'docs/data_lineage_sankey.html'

def get_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Fetch Nodes
    databases = cursor.execute("SELECT id, name FROM databases").fetchall()
    tables = cursor.execute("SELECT id, name, database_id FROM tables").fetchall()
    datasources = cursor.execute("SELECT id, name FROM datasources").fetchall()
    workbooks = cursor.execute("SELECT id, name FROM workbooks").fetchall()
    
    # 2. Fetch Relationships
    # Table -> Datasource
    cursor.execute("SELECT table_id, datasource_id FROM table_to_datasource")
    table_to_ds = cursor.fetchall()

    # Datasource -> Workbook
    cursor.execute("SELECT datasource_id, workbook_id FROM datasource_to_workbook")
    ds_to_wb = cursor.fetchall()
    
    conn.close()
    
    return {
        'databases': databases,
        'tables': tables,
        'datasources': datasources,
        'workbooks': workbooks,
        'table_to_ds': table_to_ds,
        'ds_to_wb': ds_to_wb
    }

def generate_sankey_data(data):
    nodes = []
    node_map = {} # (type, id) -> index
    
    # Define Colors
    colors = {
        'DB': '#1f77b4',      # Blue
        'Table': '#2ca02c',   # Green
        'DS': '#ff7f0e',      # Orange
        'WB': '#9467bd'       # Purple
    }
    
    node_colors = []
    labels = []
    
    def add_nodes(items, type_name):
        for item in items:
            key = (type_name, item[0])
            if key not in node_map:
                node_map[key] = len(nodes)
                # Cleanup Name (remove quotes if any)
                name = item[1]
                if name is None: name = "Unknown"
                labels.append(f"[{type_name}] {name}")
                node_colors.append(colors[type_name])
                nodes.append(item)

    # Add all nodes in layer order
    add_nodes(data['databases'], 'DB')
    add_nodes(data['tables'], 'Table')
    add_nodes(data['datasources'], 'DS')
    add_nodes(data['workbooks'], 'WB')
    
    links = {
        'source': [],
        'target': [],
        'value': []
    }
    
    def add_link(src_type, src_id, tgt_type, tgt_id):
        # Ensure nodes exist (some might be orphans, handled by add_nodes, but relations might refer to non-existents?)
        # We assume referential integrity or we check map.
        src_key = (src_type, src_id)
        tgt_key = (tgt_type, tgt_id)
        
        if src_key in node_map and tgt_key in node_map:
            links['source'].append(node_map[src_key])
            links['target'].append(node_map[tgt_key])
            links['value'].append(1)
            
    # Link: DB -> Table
    for tbl in data['tables']:
        # tbl: (id, name, db_id)
        if tbl[2]: # has db_id
            add_link('DB', tbl[2], 'Table', tbl[0])
            
    # Link: Table -> DS
    for rel in data['table_to_ds']:
        add_link('Table', rel[0], 'DS', rel[1])
        
    # Link: DS -> WB
    for rel in data['ds_to_wb']:
        add_link('DS', rel[0], 'WB', rel[1])
        
    return {
        'node': {
            'pad': 15,
            'thickness': 20,
            'line': {'color': "black", 'width': 0.5},
            'label': labels,
            'color': node_colors
        },
        'link': {
            'source': links['source'],
            'target': links['target'],
            'value': links['value'],
            # Gradient color for links? Or static grey. Use semi-transparent grey.
            'color': "rgba(0,0,0,0.2)" 
        }
    }

def create_html(sankey_data):
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Metadata Lineage Sankey Diagram</title>
    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
    <style>
        body {{ margin: 0; padding: 20px; font-family: sans-serif; }}
        #chart {{ width: 100%; height: 90vh; }}
    </style>
</head>
<body>
    <h2>Metadata Lineage Flow</h2>
    <p>Database -> Physical Table -> logical Datasource -> Workbook</p>
    <div id="chart"></div>
    <script>
        var data = {{
            type: "sankey",
            orientation: "h",
            node: {json.dumps(sankey_data['node'])},
            link: {json.dumps(sankey_data['link'])}
        }};

        var layout = {{
            title: "Metadata Asset Flow",
            font: {{ size: 12 }},
            hovermode: 'closest'
        }};

        Plotly.newPlot('chart', [data], layout);
    </script>
</body>
</html>
"""
    return html_content

if __name__ == "__main__":
    if not os.path.exists('docs'):
        os.makedirs('docs')
        
    raw_data = get_data()
    sankey_data = generate_sankey_data(raw_data)
    html = create_html(sankey_data)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(html)
        
    print(f"Generated Sankey diagram at {os.path.abspath(OUTPUT_FILE)}")
