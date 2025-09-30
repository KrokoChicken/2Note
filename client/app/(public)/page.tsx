import CollaborativeEditor from "@/components/CollabEditor/CollabEditor";

export default function Home() {
  return (
    <main>
      <CollaborativeEditor
        docSlug="demo"
        user={{ name: "Alex", color: "#10b981" }}
        wsUrl="ws://localhost:1234"
      />
    </main>
  );
}
