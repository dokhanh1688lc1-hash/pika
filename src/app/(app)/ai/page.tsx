import { AiChat } from "@/components/AiChat";
import { PageHeader } from "@/components/ui";

export default function AiPage() {
  return (
    <>
      <PageHeader title="Trợ lý AI" subtitle="Hỏi về doanh thu, tồn kho, khách hàng, lịch hẹn bằng ngôn ngữ tự nhiên" />
      <AiChat />
    </>
  );
}
