import { ActivityList } from '../components/activity-list';
export default function ActivityPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE STORY BEHIND THE PROGRESS</span>
          <h1>Activity timeline</h1>
          <p>Every change, every next step. A shared history you can trust.</p>
        </div>
      </div>
      <section className="panel">
        <ActivityList />
      </section>
    </>
  );
}
