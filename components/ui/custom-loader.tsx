export default function CustomLoader({ show = true }: { show?: boolean }) {
    return (
        show ? (
            <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
                <div className="loader" />
            </div>
        ) : null
    );
}