import React, { useCallback, useState } from 'react';
import { Upload, X, FileText, Image, FileVideo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
    onFileSelect: (file: File | null) => void;
    accept?: string;
    maxSize?: number; // in bytes
    className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
    onFileSelect,
    accept = '.jpg,.jpeg,.png,.pdf,.svg,.mp4,.txt',
    maxSize = 10 * 1024 * 1024, // 10MB default
    className,
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string>('');

    const validateFile = (file: File): string | null => {
        // Check file size
        if (file.size > maxSize) {
            return `Súbor je príliš veľký. Maximálna veľkosť je ${(maxSize / 1024 / 1024).toFixed(0)}MB`;
        }

        // Check file type
        const acceptedTypes = accept.split(',').map(t => t.trim());
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        const mimeType = file.type;

        const isValidExtension = acceptedTypes.some(type =>
            type.startsWith('.') ? fileExtension === type : mimeType.includes(type)
        );

        if (!isValidExtension) {
            return 'Nepodporovaný typ súboru. Podporované typy: JPG, PNG, PDF, SVG, MP4, TXT';
        }

        return null;
    };

    const handleFile = (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            setSelectedFile(null);
            onFileSelect(null);
            return;
        }

        setError('');
        setSelectedFile(file);
        onFileSelect(file);
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    const removeFile = () => {
        setSelectedFile(null);
        setError('');
        onFileSelect(null);
    };

    const getFileIcon = (file: File) => {
        const type = file.type;
        if (type.startsWith('image/')) return <Image className="h-8 w-8" />;
        if (type.startsWith('video/')) return <FileVideo className="h-8 w-8" />;
        return <FileText className="h-8 w-8" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className={cn('space-y-2', className)}>
            {!selectedFile ? (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                        'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                        isDragging
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/5'
                    )}
                >
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept={accept}
                        onChange={handleFileInput}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm font-medium mb-1">
                            Pretiahnite súbor sem alebo kliknite pre výber
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Podporované formáty: JPG, PNG, PDF, SVG, MP4, TXT (max {(maxSize / 1024 / 1024).toFixed(0)}MB)
                        </p>
                    </label>
                </div>
            ) : (
                <div className="border rounded-lg p-4 bg-accent/5">
                    <div className="flex items-start gap-3">
                        <div className="text-muted-foreground flex-shrink-0">
                            {getFileIcon(selectedFile)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {formatFileSize(selectedFile.size)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={removeFile}
                            className="flex-shrink-0 p-1 hover:bg-destructive/10 rounded transition-colors"
                        >
                            <X className="h-4 w-4 text-destructive" />
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
};

export default FileUpload;
