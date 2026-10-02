import pandas as pd
import networkx as nx

print("Loading transactions.csv...")
df_tx = pd.read_csv('shared-data/transactions.csv')
print(f"Total transactions: {len(df_tx)}")

print("Loading nodes.csv...")
df_nodes = pd.read_csv('shared-data/nodes.csv')
print(f"Total nodes: {len(df_nodes)}")

# Build actual graph
G = nx.Graph()
for _, row in df_tx.iterrows():
    s = str(row['source']).split('_')[0]
    t = str(row['target']).split('_')[0]
    if s != t:
        G.add_edge(s, t)

print(f"Total graph nodes with edges: {G.number_of_nodes()}")
print(f"Total graph edges: {G.number_of_edges()}")

comps = list(nx.connected_components(G))
print(f"\n==========================================")
print(f"REAL MATHEMATICAL SEPARATED ISLANDS: {len(comps)}")
print(f"==========================================")

comp_sizes = sorted([len(c) for c in comps], reverse=True)
print("\nTop 15 largest separated component sizes (Number of accounts per island):")
print(comp_sizes[:15])

# Check fraud nodes in communities
fraud_nodes = set(df_nodes[df_nodes['is_fraud'] == 1]['node_id'].apply(lambda x: str(x).split('_')[0]))
print(f"\nTotal fraud accounts: {len(fraud_nodes)}")

# Check community_id in nodes.csv
print(f"Unique communities defined in dataset (community_id): {df_nodes['community_id'].nunique()}")
print(f"Unique mule rings defined in dataset (ring_membership): {df_nodes[df_nodes['ring_membership'] > 0]['ring_membership'].nunique()}")

# See sample ring memberships
rings = df_nodes[df_nodes['ring_membership'] > 0]
ring_counts = rings.groupby('ring_membership')['node_id'].count().sort_values(ascending=False)
print("\nSample Real Mule Rings and member count in dataset:")
print(ring_counts.head(10))
